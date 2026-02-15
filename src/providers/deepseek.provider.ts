import deepseekService from "../services/ai/deepseek.service";
import { AIProvider } from "./ai-provider.interface";

export class DeepSeekProvider implements AIProvider {
  async analyzeData(structuredData: Record<string, any>, notes: string[], requestId: string) {
    return deepseekService.analyzeData(structuredData, notes, requestId);
  }
}
