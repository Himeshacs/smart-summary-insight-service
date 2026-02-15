// src/providers/provider-router.ts
import logger from "../utils/logger";
import { AIProvider } from "./ai-provider.interface";
import promptService from "../services/ai/prompt.service";
import { estimateTokens } from "../utils/token-estimator";
import { AIProviderError, ProviderName } from "./error";

type RoutedProvider = {
  name: ProviderName;
  provider: AIProvider;
  /** Rough USD cost per 1K tokens (blended). Used only for ordering. */
  cost_per_1k?: number;
};

type ProviderState = {
  cooldown_until_ms: number;
  consecutive_failures: number;
  disabled_until_ms: number; // for hard-disable (auth/payment issues)
  last_error?: { status?: number; message: string; at: string };
};

export class ProviderRouter implements AIProvider {
  private providers: RoutedProvider[];
  private state = new Map<ProviderName, ProviderState>();

  // Cooldowns
  private rateLimitCooldownMs = parseInt(process.env.AI_RL_COOLDOWN_MS || "60000", 10); // 60s
  private errorCooldownMs = parseInt(process.env.AI_ERR_COOLDOWN_MS || "15000", 10); // 15s

  // Hard-disable durations (auth/payment)
  private authDisableMs = parseInt(process.env.AI_AUTH_DISABLE_MS || String(24 * 60 * 60 * 1000), 10); // 24h
  private paymentDisableMs = parseInt(process.env.AI_PAYMENT_DISABLE_MS || String(24 * 60 * 60 * 1000), 10); // 24h

  // ✅ Local quota (dev test): max 5 requests/provider per 1 minute
  private localQuotaMax = parseInt(process.env.AI_LOCAL_QUOTA_MAX || "5", 10);
  private localQuotaWindowMs = parseInt(process.env.AI_LOCAL_QUOTA_WINDOW_MS || "60000", 10);
  private localQuota = new Map<ProviderName, number[]>(); // timestamps per provider

  constructor(providers: RoutedProvider[]) {
    if (!providers.length) throw new Error("ProviderRouter requires at least one provider");
    this.providers = providers;

    providers.forEach((p) => {
      this.state.set(p.name, {
        cooldown_until_ms: 0,
        consecutive_failures: 0,
        disabled_until_ms: 0,
      });
      this.localQuota.set(p.name, []);
    });
  }

  async analyzeData(structuredData: Record<string, any>, notes: string[], requestId: string) {
    const prompt = promptService.buildAnalysisPrompt(structuredData, notes);
    const estTokens = estimateTokens(prompt);

    const candidates = this.rankProviders(estTokens);
    let lastErr: unknown;

    for (const c of candidates) {
      // Skip if disabled (auth/payment/config) or in cooldown (rate limit/transient)
      if (this.isDisabled(c.name) || this.isInCooldown(c.name)) continue;

      // ✅ Local quota check (dev switching)
      const quotaOk = this.checkAndConsumeLocalQuota(c.name);
      const quota = this.getLocalQuotaState(c.name);

      if (!quotaOk) {
        logger.warn("Local quota exceeded; failing over", {
          requestId,
          provider: c.name,
          quota,
        });
        // Treat as rate-limited and apply same cooldown used for real 429
        this.cooldown(c.name, this.rateLimitCooldownMs);
        continue;
      }

      try {
        logger.info("Routing analysis request to provider", {
          requestId,
          provider: c.name,
          quota,
          estTokens,
          estCostUsd: this.estimateCostUsd(c, estTokens),
        });

        const result = await c.provider.analyzeData(structuredData, notes, requestId);

        this.markSuccess(c.name);
        return result;
      } catch (err) {
        lastErr = err;
        const mapped = this.toProviderError(c.name, err);
        this.recordError(c.name, mapped);

        logger.warn("Provider failed; considering failover", {
          requestId,
          provider: c.name,
          status: mapped.status,
          retryable: mapped.retryable,
          message: mapped.message,
        });

        // ✅ Better logic: always fail over on known provider/config issues
        const status = mapped.status;

        // Auth/config bad -> disable provider for long time, then try next provider
        if (status === 401 || status === 403) {
          this.disable(c.name, this.authDisableMs);
          this.markFailure(c.name);
          continue;
        }

        // Payment/credits issues -> disable provider for long time, then try next
        // (402 often means "Payment Required" / "No credits")
        if (status === 402) {
          this.disable(c.name, this.paymentDisableMs);
          this.markFailure(c.name);
          continue;
        }

        // Rate limit -> cooldown, then try next
        if (status === 429) {
          this.cooldown(c.name, this.rateLimitCooldownMs);
          this.markFailure(c.name);
          continue;
        }

        // Transient server/network -> cooldown, then try next
        if (mapped.retryable) {
          this.cooldown(c.name, this.errorCooldownMs);
          this.markFailure(c.name);
          continue;
        }

        // Non-retryable unknown -> stop
        throw mapped;
      }
    }

    // If all providers failed/disabled/cooldown
    if (lastErr instanceof Error) throw lastErr;
    throw new Error("All AI providers failed");
  }

  // Provider ordering

  private rankProviders(estTokens: number): RoutedProvider[] {
    const strategy = (process.env.AI_PROVIDER_STRATEGY || "cost_then_failover").toLowerCase();

    if (strategy === "fixed_order") return [...this.providers];

    // default: cost_then_failover
    return [...this.providers].sort((a, b) => this.estimateCostUsd(a, estTokens) - this.estimateCostUsd(b, estTokens));
  }

  private estimateCostUsd(p: RoutedProvider, tokens: number): number {
    const per1k = p.cost_per_1k ?? 0;
    return (tokens / 1000) * per1k;
  }

  // Cooldown / disable state

  private isInCooldown(name: ProviderName): boolean {
    const s = this.state.get(name);
    return !!s && Date.now() < s.cooldown_until_ms;
  }

  private cooldown(name: ProviderName, ms: number) {
    const s = this.state.get(name);
    if (!s) return;
    s.cooldown_until_ms = Math.max(s.cooldown_until_ms, Date.now() + ms);
  }

  private isDisabled(name: ProviderName): boolean {
    const s = this.state.get(name);
    return !!s && Date.now() < s.disabled_until_ms;
  }

  private disable(name: ProviderName, ms: number) {
    const s = this.state.get(name);
    if (!s) return;
    s.disabled_until_ms = Math.max(s.disabled_until_ms, Date.now() + ms);
  }

  private markSuccess(name: ProviderName) {
    const s = this.state.get(name);
    if (!s) return;
    s.consecutive_failures = 0;
    s.cooldown_until_ms = 0;
    // keep disabled_until_ms as-is (should be 0 unless manually disabled)
  }

  private markFailure(name: ProviderName) {
    const s = this.state.get(name);
    if (!s) return;
    s.consecutive_failures += 1;
  }

  private recordError(name: ProviderName, err: AIProviderError) {
    const s = this.state.get(name);
    if (!s) return;
    s.last_error = {
      status: err.status,
      message: err.message,
      at: new Date().toISOString(),
    };
  }

  // Local quota (dev testing)

  private checkAndConsumeLocalQuota(name: ProviderName): boolean {
    const now = Date.now();
    const windowStart = now - this.localQuotaWindowMs;

    const arr = this.localQuota.get(name) || [];
    const fresh = arr.filter((t) => t >= windowStart);

    if (fresh.length >= this.localQuotaMax) {
      this.localQuota.set(name, fresh);
      return false;
    }

    fresh.push(now);
    this.localQuota.set(name, fresh);
    return true;
  }

  private getLocalQuotaState(name: ProviderName) {
    const now = Date.now();
    const windowStart = now - this.localQuotaWindowMs;
    const arr = (this.localQuota.get(name) || []).filter((t) => t >= windowStart);
    return { used: arr.length, max: this.localQuotaMax, window_ms: this.localQuotaWindowMs };
  }

  // Error mapping

  private toProviderError(name: ProviderName, err: unknown): AIProviderError {
    if (err instanceof AIProviderError) return err;

    const msg = err instanceof Error ? err.message : String(err);
    const looksLikeRateLimit = /rate limit|429/i.test(msg);
    const looksLikeAuth = /invalid api key|unauthorized|forbidden|401|403/i.test(msg);
    const looksLikePayment = /payment required|402|insufficient credit|no credit/i.test(msg);

    return new AIProviderError({
      provider: name,
      message: msg,
      status: looksLikeRateLimit ? 429 : looksLikeAuth ? 401 : looksLikePayment ? 402 : undefined,
      retryable: looksLikeAuth || looksLikePayment ? false : true,
    });
  }
}
