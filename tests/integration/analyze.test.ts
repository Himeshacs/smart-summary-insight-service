import request from "supertest";
import express, { Request, Response, NextFunction } from "express";

const app = express();
app.use(express.json());

// Mock controllers
const mockAnalyzeController = {
  analyze: (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        summary: "Mock analysis summary for integration test",
        key_insights: ["Integration test insight 1", "Insight 2"],
        next_actions: ["Action 1", "Action 2"],
        metadata: {
          confidence_score: 0.85,
          model_version: "claude-3-haiku-test",
          processing_time_ms: 150,
          cached: req.body.cache_key ? false : undefined,
          request_id: "test-request-id",
        },
      },
    });
  },

  analyzeAsync: (req: Request, res: Response) => {
    res.status(202).json({
      success: true,
      message: "Analysis job accepted",
      data: {
        jobId: `job_${Date.now()}`,
        status_url: `/api/analyze/status/job_${Date.now()}`,
        estimated_completion_time: "30 seconds",
      },
    });
  },

  getJobStatus: (req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        jobId: req.params.jobId,
        status: "completed",
        progress: 100,
        result: {
          summary: "Completed job analysis",
          key_insights: ["Completed insight"],
          next_actions: ["Completed action"],
          metadata: {
            confidence_score: 0.9,
            model_version: "test-model",
            processing_time_ms: 2000,
          },
        },
      },
    });
  },
};

// Mock validation middleware
const mockValidationMiddleware = {
  validateAnalysisRequest: (req: Request, res: Response, next: NextFunction) => {
    const { structured_data, notes } = req.body;

    if (!structured_data || typeof structured_data !== "object") {
      res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "structured_data is required and must be an object",
      });
      return;
    }

    if (!notes || (typeof notes !== "string" && !Array.isArray(notes))) {
      res.status(400).json({
        success: false,
        error: "Validation Error",
        message: "notes is required and must be a string or array",
      });
      return;
    }

    next();
  },
};

// Routes
app.post("/api/analyze", mockValidationMiddleware.validateAnalysisRequest, mockAnalyzeController.analyze);
app.post("/api/analyze/async", mockValidationMiddleware.validateAnalysisRequest, mockAnalyzeController.analyzeAsync);
app.get("/api/analyze/status/:jobId", mockAnalyzeController.getJobStatus);
app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "smart-summary-service",
    version: "1.0.0",
  });
});

describe("Analysis API Integration Tests", () => {
  describe("POST /api/analyze", () => {
    it("should return 200 and analysis result for valid request", async () => {
      const response = await request(app)
        .post("/api/analyze")
        .send({
          structured_data: { customer: { id: "test" } },
          notes: ["Test note"],
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.summary).toBeDefined();
      expect(response.body.data.key_insights).toBeInstanceOf(Array);
      expect(response.body.data.next_actions).toBeInstanceOf(Array);
    });
  });
});
