/**
 * Centralized API error types.
 * All API errors must extend ApiError so they can be handled uniformly.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends ApiError {
  constructor(message = 'Network request failed', details?: Record<string, unknown>) {
    super(message, 0, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class AuthError extends ApiError {
  constructor(message = 'Authentication required', statusCode = 401) {
    super(message, statusCode, 'AUTH_ERROR');
    this.name = 'AuthError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, 404, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

export class DicomError extends ApiError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, 500, 'DICOM_ERROR', details);
    this.name = 'DicomError';
  }
}

/**
 * Type guard to check if an unknown error is an ApiError.
 */
export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
