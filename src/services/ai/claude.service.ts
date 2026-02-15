import axios, { AxiosError } from "axios";
import "dotenv/config";

import logger from "../../utils/logger";
import promptService from "./prompt.service";
import { AnalysisResponse } from "../../types";

import { parseJsonAnalysisResponse } from "./response-parser";
import { AIProviderError } from "../../providers/error";

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307";
const CLAUDE_TIMEOUT = parseInt(process.env.CLAUDE_TIMEOUT || "30000", 10);
const CLAUDE_BASE_URL = process.env.CLAUDE_BASE_URL || "https://api.anthropic.com";
const CLAUDE_MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS || "800", 10);

const CLAUDE_SYSTEM_PROMPT =
  process.env.CLAUDE_SYSTEM_PROMPT ||
  "You are a helpful AI assistant for Central Park Puppies operations team. Always respond with valid JSON in the specified format.";

type ClaudeResponse = {
  id?: string;
  model?: string;
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
};

class ClaudeService {
  constructor() {
    logger.info(`Claude service initialized with model: ${CLAUDE_MODEL}`);
  }

  async analyzeData(
    structuredData: Record<string, any>,
    notes: string[],
    requestId: string
  ): Promise<AnalysisResponse & { model_version: string; raw_response: string }> {

//     if (process.env.SIMULATE_CLAUDE_429 === "true") {
//   throw new AIProviderError({
//     provider: "claude",
//     status: 429,
//     retryable: true,
//     message: "Simulated rate limit",
//   });
// }

    if (!CLAUDE_API_KEY) {
      throw new AIProviderError({
        provider: "claude",
        retryable: false,
        message: "CLAUDE_API_KEY is missing",
      });
    }

    const startTime = Date.now();

    try {
      const prompt = promptService.buildAnalysisPrompt(structuredData, notes);

      const response = await axios.post<ClaudeResponse>(
        `${CLAUDE_BASE_URL.replace(/\/$/, "")}/v1/messages`,
        {
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS,
          system: CLAUDE_SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": process.env.CLAUDE_ANTHROPIC_VERSION || "2023-06-01",
          },
          timeout: CLAUDE_TIMEOUT,
        }
      );

      const responseTime = Date.now() - startTime;

      const content =
        response.data.content?.find((c) => c.type === "text")?.text ||
        response.data.content?.[0]?.text ||
        "";

      const analysisResult = parseJsonAnalysisResponse({
        provider: "claude",
        model: response.data.model || CLAUDE_MODEL,
        content,
      });

      logger.info("Claude API call successful", {
        requestId,
        responseTime,
        usage: response.data.usage,
        model: response.data.model || CLAUDE_MODEL,
      });

      return {
        ...analysisResult,
        model_version: response.data.model || CLAUDE_MODEL,
        raw_response: content.substring(0, 500),
      };
    } catch (error) {
      const axiosError = error as AxiosError;

      const status = axiosError.response?.status;

      // timeouts
      if (axiosError.code === "ECONNABORTED") {
        throw new AIProviderError({
          provider: "claude",
          status,
          retryable: true,
          message: "Claude request timeout",
        });
      }

      // retryable logic: 429 or 5xx -> retryable/failover; 401/403 -> not retryable
      const retryable =
        status !== undefined
          ? status === 429 || status >= 500
          : true;

      // try to extract meaningful message
      const apiMsg =
        (axiosError.response?.data as any)?.error?.message ||
        (axiosError.response?.data as any)?.message ||
        axiosError.message;

      throw new AIProviderError({
        provider: "claude",
        status,
        retryable: status === 401 || status === 403 ? false : retryable,
        message: `Claude error: ${apiMsg}`,
      });
    }
  }
}

export default new ClaudeService();
