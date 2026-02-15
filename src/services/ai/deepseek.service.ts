import axios, { AxiosError } from "axios";
import logger from "../../utils/logger";
import promptService from "./prompt.service";
import { AnalysisResponse } from "../../types";
import { parseJsonAnalysisResponse } from "./response-parser";
import "dotenv/config";
import { AIProviderError } from "../../providers/error";

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat";
const DEEPSEEK_TIMEOUT = parseInt(process.env.DEEPSEEK_TIMEOUT || "30000", 10);
const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
const DEEPSEEK_SYSTEM_PROMPT =
  process.env.DEEPSEEK_SYSTEM_PROMPT ||
  "You are a helpful AI assistant for Central Park Puppies operations team. Always respond with valid JSON in the specified format.";

type DeepSeekChatResponse = {
  id: string;
  model: string;
  choices: Array<{ message: { role: string; content: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

class DeepSeekService {
  constructor() {
    logger.info(`DeepSeek service initialized with model: ${DEEPSEEK_MODEL}`);
  }

  async analyzeData(
    structuredData: Record<string, any>,
    notes: string[],
    requestId: string
  ): Promise<AnalysisResponse & { model_version: string; raw_response: string }> {
    if (!DEEPSEEK_API_KEY) {
      throw new AIProviderError({ provider: "deepseek", retryable: false, message: "DEEPSEEK_API_KEY is missing" });
    }

    const startTime = Date.now();

    try {
      const prompt = promptService.buildAnalysisPrompt(structuredData, notes);

      // DeepSeek is OpenAI-compatible; base_url can be https://api.deepseek.com/v1 too. :contentReference[oaicite:0]{index=0}
      const response = await axios.post<DeepSeekChatResponse>(
        `${DEEPSEEK_BASE_URL.replace(/\/$/, "")}/v1/chat/completions`,
        {
          model: DEEPSEEK_MODEL,
          messages: [
            { role: "system", content: DEEPSEEK_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
          },
          timeout: DEEPSEEK_TIMEOUT,
        }
      );

      const content = response.data.choices?.[0]?.message?.content || "";
      const analysisResult = parseJsonAnalysisResponse({
        provider: "deepseek",
        model: response.data.model || DEEPSEEK_MODEL,
        content,
      });

      return {
        ...analysisResult,
        model_version: response.data.model || DEEPSEEK_MODEL,
        raw_response: content.substring(0, 500),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNABORTED") {
        throw new AIProviderError({ provider: "deepseek", status, message: "DeepSeek request timeout", retryable: true });
      }

      const retryable = status ? (status === 429 || status >= 500) : true;
      throw new AIProviderError({
        provider: "deepseek",
        status,
        retryable,
        message: `DeepSeek error: ${axiosError.message}`,
      });
    }
  }
}

export default new DeepSeekService();
