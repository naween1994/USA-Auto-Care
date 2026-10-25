import { ZodError } from 'zod';

export function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: 'Validation failed',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
  }

  if (err.name === 'VersionError' || err.code === 'VERSION_CONFLICT') {
    return res.status(409).json({
      message:
        err.message ||
        'Stale edit detected: this record was updated by another user. Please reload before saving.',
      code: 'VERSION_CONFLICT',
    });
  }

  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || {})[0] || 'record';
    return res.status(409).json({
      message: `Duplicate value for ${duplicateField}. A matching record already exists.`,
    });
  }

  const statusCode = err.statusCode || 400;
  // Never leak stack traces, tokens, or connection strings
  return res.status(statusCode).json({
    message: err.message || 'An unexpected server error occurred',
  });
}
