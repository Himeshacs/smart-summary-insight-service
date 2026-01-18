// Add this at the top of your test file
import { jest } from "@jest/globals";

// Mock the entire claude module
jest.mock("../../src/services/ai/claude.service", () => ({
  analyzeData: jest.fn(),
}));

// Mock redis service
jest.mock("../../src/services/cache/redis.service", () => ({
  get: jest.fn(),
  set: jest.fn(),
  clearPattern: jest.fn(),
}));

import claudeService from "../../src/services/ai/claude.service";
import cacheService from "../../src/services/cache/redis.service";
import { ClaudeProvider } from "../../src/providers/claude.provider";
import AnalysisService from "../../src/services/analysis.service";

// Import after mocking
const mockedClaudeService = claudeService as jest.Mocked<typeof claudeService>;
const mockedCacheService = cacheService as jest.Mocked<typeof cacheService>;

// Create service instance
const aiProvider = new ClaudeProvider();
const analysisService = new AnalysisService(aiProvider);

describe("Analysis Service Unit Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock logger to avoid console output during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("processAnalysis", () => {
    const mockStructuredData = { test: "data" };
    const mockNotes = ["Note 1", "Note 2"];
    const requestId = "test-request-id";

    it("should process analysis successfully", async () => {
      const mockAnalysisResult = {
        summary: "Test summary",
        key_insights: ["Insight 1", "Insight 2"],
        next_actions: ["Action 1", "Action 2"],
        confidence_score: 0.9,
        model_version: "claude-3-haiku-20240307",
        metadata: {
          confidence_score: 0.9,
          model_version: "claude-3-haiku-20240307",
          processing_time_ms: 0,
          timestamp: new Date().toISOString(),
        },
        raw_response: "raw",
      };

      mockedClaudeService.analyzeData.mockResolvedValue(mockAnalysisResult);

      const result = await analysisService.processAnalysis(mockStructuredData, mockNotes, requestId);

      expect(result.summary).toBe(mockAnalysisResult.summary);
      expect(result.key_insights).toEqual(mockAnalysisResult.key_insights);
      expect(result.metadata.confidence_score).toBe(0.9);
      expect(result.metadata.model_version).toBe("claude-3-haiku-20240307");
      expect(result.metadata.request_id).toBe(requestId);
      expect(mockedClaudeService.analyzeData).toHaveBeenCalledWith(mockStructuredData, mockNotes, requestId);
    });

    it("should handle LLM failure with fallback response", async () => {
      mockedClaudeService.analyzeData.mockRejectedValue(new Error("LLM error"));

      const result = await analysisService.processAnalysis(mockStructuredData, mockNotes, requestId);

      expect(result.summary).toBeDefined();
      expect(result.key_insights).toBeInstanceOf(Array);
      expect(result.metadata.fallback).toBe(true);
      expect(result.metadata.confidence_score).toBe(0.3);
    });
  });
});
