import logger from "../../utils/logger";
import { AnalysisResponse } from "../../types";

export function parseJsonAnalysisResponse(opts: {
  provider: string;
  model: string;
  content: string;
}): AnalysisResponse {
  const { provider, model, content } = opts;

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");

    const parsed = JSON.parse(jsonMatch[0]);

    const requiredFields = ["summary", "key_insights", "next_actions"];
    const missingFields = requiredFields.filter((f) => !parsed[f]);
    if (missingFields.length) {
      throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
    }

    if (!Array.isArray(parsed.key_insights)) parsed.key_insights = [parsed.key_insights];
    if (!Array.isArray(parsed.next_actions)) parsed.next_actions = [parsed.next_actions];

    const confidenceScore =
      parsed.confidence_score !== undefined
        ? Math.max(0, Math.min(1, parsed.confidence_score))
        : 0.8;

    return {
      summary: parsed.summary,
      key_insights: parsed.key_insights,
      next_actions: parsed.next_actions,
      metadata: {
        confidence_score: confidenceScore,
        model_version: parsed.model_version || model,
        processing_time_ms: 0,
        timestamp: new Date().toISOString(),
      },
    };
  } catch (error) {
    logger.error("Failed to parse AI response", {
      provider,
      error: (error as Error).message,
      content: content.substring(0, 200),
    });

    return {
      summary: "Unable to parse AI response. Please try again.",
      key_insights: ["Response parsing failed"],
      next_actions: ["Retry the analysis"],
      metadata: {
        confidence_score: 0.1,
        model_version: model,
        processing_time_ms: 0,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
