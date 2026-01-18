import "reflect-metadata";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { connectRedis, redisClient } from "./config/redis";
import swaggerSpec from "./config/swagger";
import analyzeRoutes from "./routes/analyze.routes";

// Load environment variables
dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
//middlewares
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

//Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});
app.use("/api/", limiter);

//Routes
app.use("/api/analyze", analyzeRoutes);

//health check
app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "healthy",
    redis: redisClient.isOpen ? "connected" : "disconnected",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve raw Swagger JSON
app.get('/swagger.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

app.use((_req, res) => {
  res.status(404).json({ error: "Not Found" });
});

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error",
  });
});

/* -------------------- Server Bootstrap -------------------- */
const startServer = async () => {
  try {
    console.log("🔌 Connecting to Redis...");
    await connectRedis();
    console.log("✅ Redis connected");

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 Swagger API Docs: ${BASE_URL}/api/docs`);
      console.log(`🏥 Health: ${BASE_URL}/health`);
      console.log(`🌍 Env: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== "test") {
  startServer();
}

/* -------------------- Graceful Shutdown -------------------- */
const shutdown = async () => {
  console.log("\n🛑 Shutting down gracefully...");

  if (redisClient.isOpen) {
    await redisClient.quit();
    console.log("🔌 Redis connection closed");
  }

  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default app;
