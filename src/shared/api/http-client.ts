/**
 * Base HTTP client with typed request/response handling.
 * All API clients (OrthancClient, DicomWebClient) use this internally.
 * Never use fetch() directly in components — always go through a typed client.
 */

import { ApiError, AuthError, NetworkError, NotFoundError } from './errors';

export interface HttpClientConfig {
  baseUrl: string;
  authToken?: string;
  defaultHeaders?: Record<string, string>;
}

export interface RequestOptions {
  headers?: Record<string, string>;
  signal?: AbortSignal;
  params?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(base: string, path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, base.endsWith('/') ? base : `${base}/`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    });
  }
  return url.toString();
}

export class HttpClient {
  private config: HttpClientConfig;

  constructor(config: HttpClientConfig) {
    this.config = config;
  }

  /** Update the auth token (e.g. after login or token refresh) */
  setAuthToken(token: string | undefined): void {
    this.config = { ...this.config, authToken: token };
  }

  private buildHeaders(options?: RequestOptions): Headers {
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...this.config.defaultHeaders,
      ...options?.headers,
    });
    if (this.config.authToken) {
      headers.set('Authorization', `Bearer ${this.config.authToken}`);
    }
    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.ok) {
      if (response.status === 204) return undefined as T;
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json() as Promise<T>;
      }
      return response.text() as unknown as T;
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError('Authentication failed', response.status);
    }
    if (response.status === 404) {
      throw new NotFoundError('Resource', response.url);
    }

    let errorBody: Record<string, unknown> | undefined;
    try {
      errorBody = await response.json() as Record<string, unknown>;
    } catch {
      // Response body is not JSON
    }

    throw new ApiError(
      (errorBody?.message as string) || `HTTP ${response.status}: ${response.statusText}`,
      response.status,
      'HTTP_ERROR',
      errorBody,
    );
  }

  async get<T>(path: string, options?: RequestOptions): Promise<T> {
    try {
      const url = buildUrl(this.config.baseUrl, path, options?.params);
      const response = await fetch(url, {
        method: 'GET',
        headers: this.buildHeaders(options),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError((error as Error).message);
    }
  }

  async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    try {
      const url = buildUrl(this.config.baseUrl, path, options?.params);
      const response = await fetch(url, {
        method: 'POST',
        headers: this.buildHeaders(options),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError((error as Error).message);
    }
  }

  async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    try {
      const url = buildUrl(this.config.baseUrl, path, options?.params);
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.buildHeaders(options),
        body: body !== undefined ? JSON.stringify(body) : undefined,
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError((error as Error).message);
    }
  }

  async delete<T = void>(path: string, options?: RequestOptions): Promise<T> {
    try {
      const url = buildUrl(this.config.baseUrl, path, options?.params);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.buildHeaders(options),
        signal: options?.signal,
      });
      return this.handleResponse<T>(response);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new NetworkError((error as Error).message);
    }
  }
}
