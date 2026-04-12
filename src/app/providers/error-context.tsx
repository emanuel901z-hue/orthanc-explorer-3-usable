/**
 * Error context for centralized error handling.
 * All API and operational errors flow through here — no scattered alert() or console.error().
 * User-facing errors surface as toast notifications.
 */

import { createContext, useContext, useCallback, type ReactNode } from 'react';
import { toast } from 'sonner';
import { isApiError, type ApiError, AuthError, NetworkError, NotFoundError, DicomError } from '@/shared/api/errors';

export interface ErrorContextValue {
  /** Report an error to the central handler */
  reportError: (error: unknown, context?: string) => void;
}

const ErrorContext = createContext<ErrorContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    if (error instanceof NetworkError) return 'Network error — please check your connection';
    if (error instanceof AuthError) return 'Authentication failed — please sign in again';
    if (error instanceof NotFoundError) return error.message;
    if (error instanceof DicomError) return `DICOM operation failed: ${error.message}`;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred';
}

function getErrorSeverity(error: unknown): 'error' | 'warning' {
  if (isApiError(error) && error instanceof NotFoundError) return 'warning';
  return 'error';
}

export function ErrorProvider({ children }: { children: ReactNode }) {
  const reportError = useCallback((error: unknown, context?: string) => {
    const message = getErrorMessage(error);
    const severity = getErrorSeverity(error);

    if (severity === 'warning') {
      toast.warning(message, { description: context });
    } else {
      toast.error(message, { description: context });
    }

    // TODO: Send to telemetry/error-reporting service
    // Never include PHI in error reports
  }, []);

  return (
    <ErrorContext.Provider value={{ reportError }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useErrorHandler(): ErrorContextValue {
  const ctx = useContext(ErrorContext);
  if (!ctx) throw new Error('useErrorHandler must be used within ErrorProvider');
  return ctx;
}
