import Joi from "joi";
import { Request, Response, NextFunction } from "express";
import logger from "../utils/logger";
import { AnalysisRequest, ValidationError } from "../types";

const analysisRequestSchema = Joi.object({
  structured_data: Joi.object().required().messages({
    "object.base": "structured_data must be a valid JSON object",
    "any.required": "structured_data is required",
  }),
  notes: Joi.alternatives()
    .try(Joi.string().min(1).max(10000), Joi.array().items(Joi.string().min(1).max(5000)))
    .required()
    .messages({
      "alternatives.types": "notes must be a string or array of strings",
      "string.min": "notes must not be empty",
      "any.required": "notes is required",
    }),
  cache_key: Joi.string().optional(),
  webhook_url: Joi.string().uri().optional(),
});

class ValidationMiddleware {
  validateAnalysisRequest(req: Request, res: Response, next: NextFunction): void {
    const { error, value } = analysisRequestSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const validationErrors: ValidationError[] = error.details.map((detail) => ({
        field: detail.path.join("."),
        message: detail.message,
      }));

      logger.warn("Validation failed", { errors: validationErrors });

      res.status(400).json({
        success: false,
        error: "Validation Error",
        details: validationErrors,
      });
      return;
    }

    // Sanitize notes - ensure it's always an array for consistency
    const sanitizedBody: AnalysisRequest = {
      ...value,
      notes: typeof value.notes === "string" ? [value.notes] : value.notes,
    };

    req.body = sanitizedBody;
    next();
  }
}

export default new ValidationMiddleware();
