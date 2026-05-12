import type { ErrorHandler } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { z } from 'zod';

// ─── Custom Error ────────────────────────────────────────────────

export class AppError extends Error {
  constructor(
    public statusCode: ContentfulStatusCode,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// ─── Error Handler Middleware ─────────────────────────────────────

export const errorHandler: ErrorHandler = (err, c) => {
  // Zod Validation Error
  if (err instanceof z.ZodError) {
    return c.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: { issues: err.issues },
        },
      },
      400,
    );
  }

  // Custom App Error
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.statusCode,
    );
  }

  // Unknown Error
  console.error('Unhandled error:', err);

  return c.json(
    {
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
      },
    },
    500,
  );
};
