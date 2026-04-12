/**
 * uploadDicomWithProgress — XHR-based DICOM upload with real upload progress.
 *
 * Why not fetch(): The standard fetch() API does not expose upload progress
 * events for request bodies. For DICOM files (typically 1–200 MB) this means
 * the progress bar shows 0% for the entire upload then jumps to 100%.
 *
 * XMLHttpRequest's upload.onprogress solves this. We wrap it in a Promise
 * to preserve async/await ergonomics for the caller.
 */
import { OrthancError } from '@/lib/errors';
import { newCorrelationId } from '@/lib/correlation';

function scrubbedMessage(status: number): string {
  const messages: Record<number, string> = {
    400: 'The request was invalid.',
    401: 'Authentication required.',
    403: 'You are not authorized to perform this action.',
    404: 'The requested resource was not found.',
    409: 'A conflict occurred.',
    413: 'File too large.',
    500: 'The server encountered an error.',
    502: 'Upstream service unavailable.',
    503: 'Service temporarily unavailable.',
  };
  return messages[status] ?? `Request failed (${status}).`;
}

export function uploadDicomWithProgress(
  file: File,
  endpoint: string,
  onProgress: (percent: number) => void,
): Promise<{ ID: string; Status: string }> {
  return new Promise((resolve, reject) => {
    const correlationId = newCorrelationId();
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Content-Type', 'application/dicom');

    const cleanup = () => {
      xhr.upload.removeEventListener('progress', onProgressHandler);
      xhr.removeEventListener('load', onLoadHandler);
      xhr.removeEventListener('error', onErrorHandler);
      xhr.removeEventListener('abort', onAbortHandler);
    };

    const onProgressHandler = (e: ProgressEvent) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    const onLoadHandler = () => {
      cleanup();
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { ID: string; Status: string });
        } catch {
          reject(new OrthancError(xhr.status, correlationId, 'Response could not be parsed.'));
        }
      } else {
        reject(new OrthancError(xhr.status, correlationId, scrubbedMessage(xhr.status)));
      }
    };

    const onErrorHandler = () => {
      cleanup();
      reject(new OrthancError(0, correlationId, 'Network error during upload.'));
    };

    const onAbortHandler = () => {
      cleanup();
      reject(new OrthancError(0, correlationId, 'Upload was cancelled.'));
    };

    xhr.upload.addEventListener('progress', onProgressHandler);
    xhr.addEventListener('load', onLoadHandler);
    xhr.addEventListener('error', onErrorHandler);
    xhr.addEventListener('abort', onAbortHandler);

    xhr.send(file);
  });
}
