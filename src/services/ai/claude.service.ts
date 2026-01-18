import axios, { AxiosError } from "axios";
import logger from "../../utils/logger";
import promptService from "./prompt.service";
import { AnalysisResponse, ClaudeRequest, ClaudeResponse } from "../../types";
import 'dotenv/config';

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-3-haiku-20240307";
const CLAUDE_MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS || "1000", 10);
const CLAUDE_TIMEOUT = parseInt(process.env.CLAUDE_TIMEOUT || "30000", 10);
const CLAUDE_API_URL = process.env.CLAUDE_API_URL || "https://api.anthropic.com/v1/messages";
const CLAUDE_SYSTEM_PROMPT =
  "You are a helpful AI assistant for Central Park Puppies operations team. Always respond with valid JSON in the specified format.";



class ClaudeService {
  constructor() {
    logger.info(`Claude service initialized with model: ${CLAUDE_MODEL}`);
  }

  async analyzeData(
    structuredData: Record<string, any>,
    notes: string[],
    requestId: string
  ): Promise<AnalysisResponse & { model_version: string; raw_response: string }> {
    const startTime = Date.now();

    try {
      logger.info("Calling Claude API", {
        requestId,
        model: CLAUDE_MODEL,
        structuredDataKeys: Object.keys(structuredData),
        notesCount: notes.length,
      });

      // Build prompt
      const prompt = promptService.buildAnalysisPrompt(structuredData, notes);

      const requestData: ClaudeRequest = {
        model: CLAUDE_MODEL,
        max_tokens: CLAUDE_MAX_TOKENS,
        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
        system: CLAUDE_SYSTEM_PROMPT,
      };

      const response = await axios.post<ClaudeResponse>(CLAUDE_API_URL, requestData, {
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        timeout: CLAUDE_TIMEOUT,
      });

      const responseTime = Date.now() - startTime;

      const content = response.data.content[0].text;
      const analysisResult = this.parseResponse(content);

      logger.info("Claude API call successful", {
        requestId,
        responseTime,
        usage: response.data.usage,
        confidence: analysisResult.metadata.confidence_score,
        model: response.data.model,
      });

      return {
        ...analysisResult,
        model_version: response.data.model,
        raw_response: content.substring(0, 500),
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const axiosError = error as AxiosError;

      logger.error("Claude API call failed", {
        requestId,
        responseTime,
        error: axiosError.message,
        status: axiosError.response?.status,
        data: axiosError.response?.data,
        model: CLAUDE_MODEL,
      });

      if (axiosError.response?.status === 429) throw new Error("Rate limit exceeded. Please try again later.");
      if (axiosError.response?.status === 401) throw new Error("Invalid API key. Please check configuration.");
      if (axiosError.response?.status === 404) throw new Error(`Model not found: ${CLAUDE_MODEL}. Please check model name.`);
      if (axiosError.code === "ECONNABORTED") throw new Error("API request timeout. Please try again.");

      throw new Error(`AI service error: ${axiosError.message}`);
    }
  }

  private parseResponse(content: string): AnalysisResponse {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found in response");

      const parsed = JSON.parse(jsonMatch[0]);

      const requiredFields = ["summary", "key_insights", "next_actions"];
      const missingFields = requiredFields.filter((field) => !parsed[field]);
      if (missingFields.length > 0) throw new Error(`Missing required fields: ${missingFields.join(", ")}`);

      // Normalize arrays
      if (!Array.isArray(parsed.key_insights)) parsed.key_insights = [parsed.key_insights];
      if (!Array.isArray(parsed.next_actions)) parsed.next_actions = [parsed.next_actions];

      const confidenceScore = parsed.confidence_score !== undefined
        ? Math.max(0, Math.min(1, parsed.confidence_score))
        : 0.8;

      return {
        summary: parsed.summary,
        key_insights: parsed.key_insights,
        next_actions: parsed.next_actions,
        metadata: {
          confidence_score: confidenceScore,
          model_version: parsed.model_version || CLAUDE_MODEL,
          processing_time_ms: 0, // caller can set
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      logger.error("Failed to parse Claude response", {
        error: (error as Error).message,
        content: content.substring(0, 200),
      });

      return {
        summary: "Unable to parse AI response. Please try again.",
        key_insights: ["Response parsing failed"],
        next_actions: ["Retry the analysis"],
        metadata: {
          confidence_score: 0.1,
          model_version: CLAUDE_MODEL,
          processing_time_ms: 0,
          timestamp: new Date().toISOString(),
        },
      };
    }
  }
}

export default new ClaudeService();
