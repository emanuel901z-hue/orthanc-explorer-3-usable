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

export function uploadDicomWithProgress(
  file: File,
  endpoint: string,
  onProgress: (percent: number) => void,
): Promise<{ ID: string; Status: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Content-Type', 'application/dicom');

    xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as { ID: string; Status: string });
        } catch {
          reject(new OrthancError(xhr.status, 'upload-xhr', 'Invalid JSON response from /instances'));
        }
      } else {
        reject(new OrthancError(xhr.status, 'upload-xhr', 'Upload failed'));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new OrthancError(0, 'upload-xhr', 'Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new OrthancError(0, 'upload-xhr', 'Upload aborted'));
    });

    xhr.send(file);
  });
}
