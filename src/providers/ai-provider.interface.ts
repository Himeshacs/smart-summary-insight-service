import { AnalysisResponse } from "../types";

export interface AIProvider {
  analyzeData(
    structuredData: Record<string, any>,
    notes: string[],
    requestId: string
  ): Promise<AnalysisResponse & { model_version: string; raw_response: string }>;
}
