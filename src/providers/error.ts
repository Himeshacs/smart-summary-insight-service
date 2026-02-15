export type ProviderName = "claude" | "openai" | "deepseek";

export class AIProviderError extends Error {
  provider: ProviderName;
  status?: number;
  retryable: boolean;

  constructor(opts: { provider: ProviderName; message: string; status?: number; retryable?: boolean }) {
    super(opts.message);
    this.name = "AIProviderError";
    this.provider = opts.provider;
    this.status = opts.status;
    this.retryable = opts.retryable ?? true;
  }
}
