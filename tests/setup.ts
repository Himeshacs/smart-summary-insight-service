process.env.NODE_ENV = "test";
process.env.PORT = "3001";
process.env.CLAUDE_API_KEY = "test-key-not-real";
process.env.CLAUDE_MODEL = "claude-3-haiku-test";
process.env.REDIS_URL = "redis://localhost:6380";

// Silence logs during tests
import logger from "../src/utils/logger";
logger.transports.forEach((t) => (t.silent = true));
