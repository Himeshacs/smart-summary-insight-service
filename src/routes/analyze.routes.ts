import express from "express";
import validationMiddleware from "../middleware/validation.middleware";
import AnalyzeController from "../controllers/analyze.controller";
import { ClaudeProvider } from "../providers/claude.provider";
import AnalysisService from "../services/analysis.service";
import { ProviderName } from "../providers/error";
import { OpenAIProvider } from "../providers/openai.provider";
import { DeepSeekProvider } from "../providers/deepseek.provider";
import { ProviderRouter } from "../providers/provider-router";

const router = express.Router();

const enabled = (process.env.AI_PROVIDERS_ENABLED || "claude")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean) as ProviderName[];

const providers = enabled.map((name) => {
  switch (name) {
    case "openai":
      return { name, provider: new OpenAIProvider(), cost_per_1k: parseFloat(process.env.OPENAI_COST_PER_1K || "0.0002") };
    case "deepseek":
      return { name, provider: new DeepSeekProvider(), cost_per_1k: parseFloat(process.env.DEEPSEEK_COST_PER_1K || "0.0001") };
    case "claude":
    default:
      return { name: "claude" as const, provider: new ClaudeProvider(), cost_per_1k: parseFloat(process.env.CLAUDE_COST_PER_1K || "0.00025") };
  }
});

const aiProvider = new ProviderRouter(providers);

const analysisService = new AnalysisService(aiProvider);
const analyzeController = new AnalyzeController(analysisService);

// Routes
router.post("/", validationMiddleware.validateAnalysisRequest, analyzeController.analyze.bind(analyzeController));
router.post("/async", validationMiddleware.validateAnalysisRequest, analyzeController.analyzeAsync.bind(analyzeController));
router.get("/status/:jobId", analyzeController.getJobStatus.bind(analyzeController));

export default router;
