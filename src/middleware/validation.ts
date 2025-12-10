/**
 * Validation Middleware for Omni-Dromenon-Engine
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';

// =============================================================================
// TYPES
// =============================================================================

export interface ValidationError {
  path: string;
  message: string;
}

// =============================================================================
// MIDDLEWARE
// =============================================================================

/**
 * Validate request body against a Zod schema.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }
    
    req.body = result.data;
    next();
  };
}

/**
 * Validate request query parameters against a Zod schema.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }
    
    req.query = result.data as any;
    next();
  };
}

/**
 * Validate request params against a Zod schema.
 */
export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      res.status(400).json({
        error: 'Validation failed',
        details: errors,
      });
      return;
    }
    
    req.params = result.data as any;
    next();
  };
}

/**
 * Format Zod errors into a more readable format.
 */
function formatZodErrors(error: ZodError): ValidationError[] {
  return error.errors.map(err => ({
    path: err.path.join('.'),
    message: err.message,
  }));
}

// =============================================================================
// COMMON SCHEMAS
// =============================================================================

export const ParameterInputSchema = z.object({
  parameter: z.string().min(1).max(50),
  value: z.number().min(0).max(1),
});

export const LocationSchema = z.object({
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  zone: z.string().optional(),
});

export const OverrideSchema = z.object({
  parameter: z.string().min(1).max(50),
  value: z.number().min(0).max(1),
  mode: z.enum(['absolute', 'blend', 'lock']),
  blendFactor: z.number().min(0).max(1).optional(),
  durationMs: z.number().positive().optional(),
  reason: z.string().max(200).optional(),
});

export const SessionConfigSchema = z.object({
  allowAudienceInput: z.boolean().optional(),
  allowPerformerOverride: z.boolean().optional(),
  maxParticipants: z.number().positive().optional(),
  inputRateLimitMs: z.number().positive().optional(),
  consensusIntervalMs: z.number().positive().optional(),
});

// =============================================================================
// UTILITY
// =============================================================================

/**
 * Validate data against schema without middleware.
 */
export function validate<T>(schema: ZodSchema<T>, data: unknown): {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Assert data matches schema, throw if invalid.
 */
export function assert<T>(schema: ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}
