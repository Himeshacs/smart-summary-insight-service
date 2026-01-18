import { v4 as uuidv4 } from "uuid";
import Queue from "bull";
import axios from "axios";
import cacheService from "./cache/redis.service";
import logger from "../utils/logger";
import { AnalysisResponse, JobStatus, JobData } from "../types";
import { AIProvider } from "../providers/ai-provider.interface";
import 'dotenv/config';

class AnalysisService {
  private analysisQueue: Queue.Queue;
  private aiProvider: AIProvider;

  // Inject the AI provider
  constructor(aiProvider: AIProvider) {
    this.aiProvider = aiProvider;

    // Initialize job queue for async processing
    this.analysisQueue = new Queue("analysis", {
      redis: {
        host: process.env.REDIS_HOST || "localhost",
        port: parseInt(process.env.REDIS_PORT || "6379"),
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 1000,
        },
        timeout: 30000,
      },
    });

    this.setupQueueHandlers();
  }

  private setupQueueHandlers(): void {
    this.analysisQueue.process(async (job: Queue.Job) => {
      const { structured_data, notes, webhook_url } = job.data;

      try {
        const result = await this.processAnalysis(structured_data, notes, job.id.toString());

        // If webhook URL provided, send results
        if (webhook_url) {
          await this.sendWebhook(webhook_url, result);
        }

        return result;
      } catch (error) {
        logger.error("Analysis job failed", { jobId: job.id, error: (error as Error).message });
        throw error;
      }
    });

    this.analysisQueue.on("completed", (job: Queue.Job, result: any) => {
      logger.info("Analysis job completed", { jobId: job.id });
      cacheService.set(`job:${job.id}`, result, 86400);
    });

    this.analysisQueue.on("failed", (job: Queue.Job | undefined, error: Error) => {
      if (job) {
        logger.error("Analysis job failed", {
          jobId: job.id,
          error: error.message,
          attemptsMade: job.attemptsMade,
        });
      }
    });
  }

  async processAnalysis(structuredData: Record<string, any>, notes: string | string[], requestId: string): Promise<AnalysisResponse> {
    const startTime = Date.now();
    const notesArray = Array.isArray(notes) ? notes : [notes];

    try {
      logger.info("Processing analysis via AI provider", { requestId });

      // Use the injected AI provider
      const analysisResult = await this.aiProvider.analyzeData(structuredData, notesArray, requestId);

      const processingTime = Date.now() - startTime;

      return {
        summary: analysisResult.summary,
        key_insights: analysisResult.key_insights,
        next_actions: analysisResult.next_actions,
        metadata: {
          ...analysisResult.metadata,
          processing_time_ms: processingTime,
          request_id: requestId,
        },
      };
    } catch (error) {
      logger.error("Analysis processing failed", {
        requestId,
        error: (error as Error).message,
        processingTime: Date.now() - startTime,
      });

      return this.generateFallbackResponse(structuredData, notesArray, requestId);
    }
  }

  async queueAnalysisJob(jobData: JobData): Promise<Queue.Job> {
    const job = await this.analysisQueue.add(jobData, {
      jobId: jobData.jobId,
      priority: 1,
    });

    logger.info("Job queued", { jobId: job.id });
    return job;
  }

  async getJobStatus(jobId: string): Promise<JobStatus> {
    try {
      const job = await this.analysisQueue.getJob(jobId);

      if (!job) {
        const cachedResult = await cacheService.get(`job:${jobId}`);
        if (cachedResult) {
          return {
            jobId: jobId,
            status: "completed",
            result: cachedResult,
            completed_at: new Date().toISOString(),
          };
        }
        return { jobId: jobId, status: "not_found" };
      }

      const state = await job.getState();
      const status: JobStatus = {
        jobId: jobId,
        status: state as JobStatus["status"],
        progress: job.progress(),
        attempts_made: job.attemptsMade,
        created_at: job.timestamp ? new Date(job.timestamp).toISOString() : undefined,
        processed_on: job.processedOn ? new Date(job.processedOn).toISOString() : undefined,
      };

      if (state === "completed") {
        status.result = job.returnvalue;
        status.completed_at = job.finishedOn ? new Date(job.finishedOn).toISOString() : undefined;
      } else if (state === "failed") {
        status.error = job.failedReason;
      }

      return status;
    } catch (error) {
      logger.error("Error getting job status", { jobId, error: (error as Error).message });
      throw error;
    }
  }

  private async sendWebhook(url: string, data: any): Promise<void> {
    try {
      await axios.post(url, data, {
        headers: { "Content-Type": "application/json" },
        timeout: 5000,
      });
      logger.info("Webhook sent successfully", { url });
    } catch (error) {
      logger.error("Failed to send webhook", { url, error: (error as Error).message });
    }
  }

  private generateFallbackResponse(structuredData: Record<string, any>, notes: string[], requestId: string): AnalysisResponse {
    const summary = `Analysis of ${Object.keys(structuredData).length} data fields and ${notes.length} notes.`;

    return {
      summary,
      key_insights: ["System generated basic analysis due to service limitations", "Please try again later for AI-powered insights"],
      next_actions: ["Retry analysis in a few moments", "Contact support if issue persists"],
      metadata: {
        confidence_score: 0.3,
        model_version: "fallback-v1",
        processing_time_ms: 100,
        timestamp: new Date().toISOString(),
        request_id: requestId,
        fallback: true,
      },
    };
  }
}

export default AnalysisService;
