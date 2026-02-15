import axios, { AxiosError } from "axios";
import logger from "../../utils/logger";
import promptService from "./prompt.service";
import { AnalysisResponse } from "../../types";
import { parseJsonAnalysisResponse } from "./response-parser";
import "dotenv/config";
import { AIProviderError } from "../../providers/error";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const OPENAI_TIMEOUT = parseInt(process.env.OPENAI_TIMEOUT || "30000", 10);
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
const OPENAI_SYSTEM_PROMPT =
  process.env.OPENAI_SYSTEM_PROMPT ||
  "You are a helpful AI assistant for Central Park Puppies operations team. Always respond with valid JSON in the specified format.";

type OpenAIChatResponse = {
  id: string;
  model: string;
  choices: Array<{ message: { role: string; content: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

class OpenAIService {
  constructor() {
    logger.info(`OpenAI service initialized with model: ${OPENAI_MODEL}`);
  }

  async analyzeData(
    structuredData: Record<string, any>,
    notes: string[],
    requestId: string
  ): Promise<AnalysisResponse & { model_version: string; raw_response: string }> {
    if (!OPENAI_API_KEY) {
      throw new AIProviderError({ provider: "openai", retryable: false, message: "OPENAI_API_KEY is missing" });
    }

    const startTime = Date.now();

    try {
      const prompt = promptService.buildAnalysisPrompt(structuredData, notes);

      const response = await axios.post<OpenAIChatResponse>(
        `${OPENAI_BASE_URL.replace(/\/$/, "")}/chat/completions`,
        {
          model: OPENAI_MODEL,
          messages: [
            { role: "system", content: OPENAI_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          temperature: 0.2,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          timeout: OPENAI_TIMEOUT,
        }
      );

      const responseTime = Date.now() - startTime;

      const content = response.data.choices?.[0]?.message?.content || "";
      const analysisResult = parseJsonAnalysisResponse({
        provider: "openai",
        model: response.data.model || OPENAI_MODEL,
        content,
      });

      logger.info("OpenAI API call successful", {
        requestId,
        responseTime,
        usage: response.data.usage,
        model: response.data.model,
      });

      return {
        ...analysisResult,
        model_version: response.data.model || OPENAI_MODEL,
        raw_response: content.substring(0, 500),
      };
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (axiosError.code === "ECONNABORTED") {
        throw new AIProviderError({ provider: "openai", status, message: "OpenAI request timeout", retryable: true });
      }

      const retryable = status ? (status === 429 || status >= 500) : true;
      throw new AIProviderError({
        provider: "openai",
        status,
        retryable,
        message: `OpenAI error: ${axiosError.message}`,
      });
    }
  }
}

export default new OpenAIService();
