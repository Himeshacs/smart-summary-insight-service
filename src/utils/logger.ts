import winston from "winston";
import { Request, Response, NextFunction } from "express";
import * as crypto from "crypto";

declare module "winston" {
  interface Logger {
    addRequestId(req: Request, res: Response, next: NextFunction): void;
    withContext(context: Record<string, any>): winston.Logger;
    morganMiddleware(req: Request, res: Response, next: NextFunction): void;
  }
}

declare global {
  namespace Express {
    interface Request {
      id?: string;
    }
  }
}

const { combine, timestamp, printf, colorize } = winston.format;

// Custom log format
const logFormat = printf(
  ({ level, message, timestamp, ...metadata }: any) => {
    let msg = `${timestamp} [${level}] : ${message}`;
    if (metadata && Object.keys(metadata).length > 0) {
      msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
  }
);

// Create Winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), logFormat),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),

    // File transport for all logs
    new winston.transports.File({
      filename: "logs/combined.log",
      maxsize: 5 * 1024 * 1024, // 5MB
      maxFiles: 5,
    }),
  ],
  exitOnError: false,
});

logger.addRequestId = function (
  req: Request,
  res: Response,
  next: NextFunction
): void {
  req.id = (req.headers["x-request-id"] as string) || crypto.randomBytes(8).toString("hex");
  next();
};

logger.withContext = function (context: Record<string, any>): winston.Logger {
  return logger.child(context);
};

logger.morganMiddleware = function (
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();
  const originalEnd = res.end as (...args: any[]) => any;

  (res as any).end = function (this: Response, ...args: any[]) {
    const duration = Date.now() - start;

    logger.info("HTTP Request", {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get("User-Agent"),
      requestId: req.id,
    });

    return originalEnd.apply(this, args);
  };

  next();
};

export default logger;
