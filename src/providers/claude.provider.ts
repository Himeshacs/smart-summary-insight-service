import claudeService from "../services/ai/claude.service";
import { AIProvider } from "./ai-provider.interface";

export class ClaudeProvider implements AIProvider {
  async analyzeData(structuredData: Record<string, any>, notes: string[], requestId: string) {
    return claudeService.analyzeData(structuredData, notes, requestId);
  }
}
