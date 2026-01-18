import { v4 as uuidv4 } from "uuid";
import { Request, Response, NextFunction } from "express";
import { AnalysisRequestWithId, JobStatus } from "../types";
import cacheService from "../services/cache/redis.service";
import logger from "../utils/logger";
import helpers from "../utils/helpers";
import AnalysisService from "../services/analysis.service";

class AnalyzeController {

    constructor(private analysisService: AnalysisService) {}

  /**
   * @swagger
   * /api/analyze:
   *   post:
   *     summary: Perform synchronous analysis
   *     tags: [Analysis]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - structured_data
   *             properties:
   *               structured_data:
   *                 type: object
   *                 example:
   *                   title: "Quarterly Report"
   *                   revenue: 120000
   *               notes:
   *                 type: string
   *                 example: "Focus on growth trends"
   *     responses:
   *       200:
   *         description: Analysis completed successfully
   *       500:
   *         description: Internal server error
   */
  async analyze(
    req: AnalysisRequestWithId,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { structured_data, notes } = req.body;
      const requestId = uuidv4();

      //generate cache key
      const cacheKey = helpers.generateCacheKey(structured_data, notes);
      logger.info("Analysis request received", {
        requestId,
        structuredDataKeys: Object.keys(structured_data || {}),
      });

      // First checking cache 
      const cachedResultStr = await cacheService.get(cacheKey);
      if (cachedResultStr) {
        const cachedResult = JSON.parse(cachedResultStr);
        logger.info("Cache hit", { requestId, cacheKey });

        res.status(200).json({
          success: true,
          data: {
            ...cachedResult,
            metadata: {
              ...cachedResult.metadata,
              cached: true,
              request_id: requestId,
            },
          },
        });
        return;
      }

      // Call AI service if cache is missing
      const analysisResult = await this.analysisService.processAnalysis(
        structured_data,
        notes,
        requestId,
      );

      // Store result in cache for 1hr
      await cacheService.set(cacheKey, JSON.stringify(analysisResult), 3600);

      res.status(200).json({
        success: true,
        data: {
          ...analysisResult,
          metadata: {
            ...analysisResult.metadata,
            cached: false,
            request_id: requestId,
            cache_key: cacheKey,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/analyze/async:
   *   post:
   *     summary: Submit asynchronous analysis job
   *     tags: [Analysis]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - structured_data
   *             properties:
   *               structured_data:
   *                 type: object
   *               notes:
   *                 type: string
   *               webhook_url:
   *                 type: string
   *                 example: "https://example.com/webhook"
   *     responses:
   *       202:
   *         description: Analysis job accepted
   */
  async analyzeAsync(
    req: AnalysisRequestWithId,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { structured_data, notes, webhook_url } = req.body;
      const jobId = uuidv4();

      logger.info("Async analysis requested", { jobId });

      await this.analysisService.queueAnalysisJob({
        jobId,
        structured_data,
        notes,
        webhook_url,
      });

      res.status(202).json({
        success: true,
        message: "Analysis job accepted",
        data: {
          jobId: jobId,
          status_url: `/api/analyze/status/${jobId}`,
          estimated_completion_time: "30 seconds",
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * @swagger
   * /api/analyze/status/{jobId}:
   *   get:
   *     summary: Get async analysis job status
   *     tags: [Analysis]
   *     parameters:
   *       - in: path
   *         name: jobId
   *         required: true
   *         schema:
   *           type: string
   *         description: Analysis job ID
   *     responses:
   *       200:
   *         description: Job status retrieved
   *       404:
   *         description: Job not found
   */
  async getJobStatus(
    req: Request<JobStatus>,
    res: Response,
    next: NextFunction,
  ): Promise<void> {
    try {
      const { jobId } = req.params;

      const status = await this.analysisService.getJobStatus(jobId);

      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (error) {
      next(error);
    }
  }
}

export default AnalyzeController;
