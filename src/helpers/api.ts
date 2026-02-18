import { getToken, invalidateToken } from "./firebase";

interface FetchOptions extends RequestInit {
  retries?: number;
  retryDelay?: number;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  status?: number;
}

/**
 * A fetch wrapper with automatic retry logic for authentication failures.
 *
 * Features:
 * - Automatically retries on 401/403 auth errors with token refresh
 * - Exponential backoff between retries
 * - Distinguishes between auth, network, and server errors
 *
 * @param url - The URL to fetch
 * @param options - Fetch options with optional retries and retryDelay
 * @returns ApiResponse with data or error information
 */
export async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<ApiResponse<T>> {
  const {
    retries = 2,
    retryDelay = 1000,
    headers: originalHeaders,
    ...restOptions
  } = options;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= retries) {
    try {
      // Force refresh token on retry attempts
      const token = await getToken(attempt > 0);

      if (!token) {
        return { error: "You are not authenticated." };
      }

      const response = await fetch(url, {
        ...restOptions,
        headers: {
          ...originalHeaders,
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        return { data, status: response.status };
      }

      // Auth errors - invalidate token and retry
      if (response.status === 401 || response.status === 403) {
        invalidateToken();
        lastError = new Error(`Auth failed: ${response.status}`);

        if (attempt < retries) {
          const delay = retryDelay * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          attempt++;
          continue;
        }
      }

      // Other errors - don't retry
      return {
        error: `Server responded with ${response.status}`,
        status: response.status,
      };
    } catch (error) {
      lastError = error as Error;

      // Network errors might be worth retrying
      if (attempt < retries) {
        const delay = retryDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        attempt++;
        continue;
      }

      return { error: lastError.message };
    }
  }

  return { error: lastError?.message || "Max retries exceeded" };
}
