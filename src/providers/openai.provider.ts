import openaiService from "../services/ai/openai.service";
import { AIProvider } from "./ai-provider.interface";

export class OpenAIProvider implements AIProvider {
  async analyzeData(structuredData: Record<string, any>, notes: string[], requestId: string) {
    return openaiService.analyzeData(structuredData, notes, requestId);
  }
}
