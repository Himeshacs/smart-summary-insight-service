import express from "express";
import validationMiddleware from "../middleware/validation.middleware";
import AnalyzeController from "../controllers/analyze.controller";
import { ClaudeProvider } from "../providers/claude.provider";
import AnalysisService from "../services/analysis.service";


const router = express.Router();
const aiProvider = new ClaudeProvider();
const analysisService = new AnalysisService(aiProvider);
const analyzeController = new AnalyzeController(analysisService);

// Routes
router.post("/", validationMiddleware.validateAnalysisRequest, analyzeController.analyze.bind(analyzeController));
router.post("/async", validationMiddleware.validateAnalysisRequest, analyzeController.analyzeAsync.bind(analyzeController));
router.get("/status/:jobId", analyzeController.getJobStatus.bind(analyzeController));


export default router;
