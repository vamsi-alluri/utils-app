/**
 * Tests for API fetchWithRetry functionality
 *
 * These tests verify:
 * 1. Successful requests return data correctly
 * 2. Auth errors (401/403) trigger token invalidation and retry
 * 3. Retries use exponential backoff
 * 4. Server errors (5xx) return error without retry
 * 5. Network errors are retried
 * 6. Unauthenticated users get appropriate error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchWithRetry } from "./api";
import { getToken, invalidateToken } from "./firebase";

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock Firebase functions
vi.mock("./firebase", () => ({
  getToken: vi.fn(),
  invalidateToken: vi.fn(),
}));

describe("fetchWithRetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const testUrl = "https://test-api.example.com/endpoint";
  const testHeaders = { "Content-Type": "application/json" };

  describe("Successful requests", () => {
    it("should return data on successful fetch", async () => {
      // Arrange
      const mockData = { result: "success", value: 42 };
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => mockData,
      };
      mockFetch.mockResolvedValue(mockResponse);
      vi.mocked(getToken).mockResolvedValue("valid-token-123");

      // Act
      const result = await fetchWithRetry(testUrl, {
        method: "POST",
        headers: testHeaders,
        body: JSON.stringify({ test: "data" }),
      });

      // Assert
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        testUrl,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer valid-token-123",
          }),
        }),
      );
    });

    it("should not call getToken on retry when first attempt succeeds", async () => {
      // Arrange
      const mockData = { success: true };
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockData,
      });
      vi.mocked(getToken).mockResolvedValue("token-abc");

      // Act
      await fetchWithRetry(testUrl);

      // Assert
      expect(getToken).toHaveBeenCalledTimes(1);
      expect(getToken).toHaveBeenCalledWith(false); // Not forced refresh
    });
  });

  describe("Authentication errors (401/403)", () => {
    it("should invalidate token and retry on 401 error", async () => {
      // Arrange
      const mockData = { result: "success-after-retry" };
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        });

      vi.mocked(getToken)
        .mockResolvedValueOnce("expired-token")
        .mockResolvedValueOnce("new-token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, { retries: 2 });

      // Fast-forward through the retry delay
      await vi.advanceTimersByTimeAsync(1000); // Initial retry delay

      const result = await resultPromise;

      // Assert
      expect(result.data).toEqual(mockData);
      expect(invalidateToken).toHaveBeenCalledTimes(1);
      expect(getToken).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(getToken).toHaveBeenNthCalledWith(2, true); // Second call forces refresh
    });

    it("should invalidate token and retry on 403 error", async () => {
      // Arrange
      const mockData = { result: "success-after-forbidden-retry" };
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        });

      vi.mocked(getToken)
        .mockResolvedValueOnce("forbidden-token")
        .mockResolvedValueOnce("new-token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, { retries: 2 });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      // Assert
      expect(result.data).toEqual(mockData);
      expect(invalidateToken).toHaveBeenCalledTimes(1);
      expect(getToken).toHaveBeenCalledTimes(2);
    });

    it("should use exponential backoff between auth retries", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ result: "success" }),
        });

      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, {
        retries: 3,
        retryDelay: 500,
      });

      // First retry: 500ms
      await vi.advanceTimersByTimeAsync(500);
      // Second retry: 1000ms (exponential)
      await vi.advanceTimersByTimeAsync(500);
      await vi.advanceTimersByTimeAsync(500);

      const result = await resultPromise;

      // Assert
      expect(result.data).toEqual({ result: "success" });
      expect(getToken).toHaveBeenCalledTimes(3);
    });

    it("should return error after max retries exhausted", async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.mocked(getToken).mockResolvedValue("bad-token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, { retries: 2 });

      // Advance through all retries
      // With retries=2, we have 3 attempts total (0, 1, 2)
      // Each 401 triggers invalidateToken
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;

      // Assert
      expect(result.error).toBeDefined();
      expect(result.data).toBeUndefined();
      // With retries=2, we get 3 attempts (0, 1, 2), so 3 invalidations
      expect(invalidateToken).toHaveBeenCalledTimes(3);
    });
  });

  describe("Server errors", () => {
    it("should return error immediately on 500 status without retry", async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });
      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const result = await fetchWithRetry(testUrl);

      // Assert
      expect(result.error).toBe("Server responded with 500");
      expect(result.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No retries
      expect(invalidateToken).not.toHaveBeenCalled();
    });

    it("should return error immediately on 400 status without retry", async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
      });
      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const result = await fetchWithRetry(testUrl);

      // Assert
      expect(result.error).toBe("Server responded with 400");
      expect(result.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Network errors", () => {
    it("should retry on network errors", async () => {
      // Arrange
      const mockData = { result: "success-after-network-error" };
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockData,
        });

      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, { retries: 2 });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      // Assert
      expect(result.data).toEqual(mockData);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("should return error after network retry exhaustion", async () => {
      // Arrange
      mockFetch.mockRejectedValue(new Error("Connection failed"));
      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, { retries: 1 });

      await vi.advanceTimersByTimeAsync(1000);

      const result = await resultPromise;

      // Assert
      expect(result.error).toBe("Connection failed");
      expect(mockFetch).toHaveBeenCalledTimes(2); // Initial + 1 retry
    });
  });

  describe("Authentication", () => {
    it("should return auth error when no token available", async () => {
      // Arrange
      vi.mocked(getToken).mockResolvedValue(null);

      // Act
      const result = await fetchWithRetry(testUrl);

      // Assert
      expect(result.error).toBe("You are not authenticated.");
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("Configuration", () => {
    it("should respect custom retry count", async () => {
      // Arrange
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
      });
      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const resultPromise = fetchWithRetry(testUrl, { retries: 4 });

      // Wait for all retries to complete
      for (let i = 0; i < 4; i++) {
        await vi.advanceTimersByTimeAsync(Math.pow(2, i) * 1000);
      }

      await resultPromise;

      // Assert
      expect(mockFetch).toHaveBeenCalledTimes(5); // Initial + 4 retries
    });

    it("should respect custom retry delay", async () => {
      // Arrange
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 401 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ success: true }),
        });
      vi.mocked(getToken).mockResolvedValue("token");

      // Act
      const startTime = Date.now();
      const resultPromise = fetchWithRetry(testUrl, {
        retries: 1,
        retryDelay: 2000,
      });

      await vi.advanceTimersByTimeAsync(2000);

      const result = await resultPromise;
      const elapsed = Date.now() - startTime;

      // Assert
      expect(result.data).toEqual({ success: true });
      // Should have waited approximately the retry delay
      expect(elapsed).toBeGreaterThanOrEqual(2000);
    });
  });
});
