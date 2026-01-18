declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

export interface AnalysisRequest {
  structured_data: Record<string, any>;
  notes: string | string[];
  cache_key?: string;
  webhook_url?: string;
}

export interface AnalysisResponse {
  [x: string]: any;
  summary: string;
  key_insights: string[];
  next_actions: string[];
  metadata: AnalysisMetadata;
}

export interface AnalysisMetadata {
  confidence_score: number;
  model_version: string;
  processing_time_ms: number;
  timestamp: string;
  request_id?: string;
  cached?: boolean;
  cache_key?: string;
  fallback?: boolean;
}

export interface JobStatus {
  jobId: string;
  status: "pending" | "active" | "completed" | "failed" | "delayed" | "waiting" | "not_found";
  progress?: number;
  result?: AnalysisResponse;
  error?: string;
  created_at?: string;
  processed_on?: string;
  completed_at?: string;
  attempts_made?: number;
}

export interface JobData {
  jobId: string;
  structured_data: Record<string, any>;
  notes: string | string[];
  webhook_url?: string;
}

// Claude API Types
export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  messages: ClaudeMessage[];
  system?: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: null | string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface CacheService {
  get(key: string): Promise<any>;
  set(key: string, value: any, ttlSeconds?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  getKeys(pattern: string): Promise<string[]>;
  clearPattern(pattern: string): Promise<number>;
  healthCheck(): Promise<{ status: string; message: string }>;
}

export interface LLMProvider {
  providerName: string;
  analyze(structuredData: Record<string, any>, notes: string[]): Promise<any>;
  validateResponse(response: any): boolean;
  getCostEstimate(tokens: number): number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiError extends Error {
  statusCode?: number;
  details?: ValidationError[];
  code?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  id?: string;
  user?: any;
}

export interface AnalysisRequestWithId extends Express.Request {
  id?: string;
  body: AnalysisRequest;
}
