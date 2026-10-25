import { fetch as expoFetch } from 'expo/fetch';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

export type ApiUser = {
  studentId: string;
  name: string;
  roles: string[];
  hostelId?: string;
  hostelIds?: string[];
};

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export async function apiRequest<T>(
  path: string,
  token?: string,
  options: RequestInit = {},
): Promise<T> {
  let response: Response;
  try {
    const requestFetch = options.body instanceof FormData ? expoFetch : fetch;
    response = await requestFetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (reason) {
    const nativeMessage = reason instanceof Error && reason.message ? ` (${reason.message})` : '';
    throw new ApiError(`Could not reach AttendX at ${API_BASE_URL} while calling ${path}${nativeMessage}. Check that the API is running and reachable from your phone.`, 0);
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      result?.error?.message || result?.message || `Request failed (${response.status}).`,
      response.status,
      result?.error?.code,
    );
  }
  return result as T;
}

export async function apiDownload(path: string, token: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError('Could not reach the AttendX API.', 0);
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new ApiError(result?.error?.message || 'Could not download this report.', response.status);
  }
  return response.text();
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
