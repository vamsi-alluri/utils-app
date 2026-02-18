/**
 * Tests for Firebase token caching functionality
 *
 * These tests verify:
 * 1. Token is cached and returned on subsequent calls
 * 2. Token refresh is triggered when near expiry
 * 3. Force refresh bypasses cache
 * 4. Token invalidation clears the cache
 * 5. Returns null when no user is authenticated
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to mock the entire firebase module before importing the code under test
const mockGetIdToken = vi.fn();
const mockCurrentUser = {
  getIdToken: mockGetIdToken,
};

let authCurrentUser: any = null;

// Mock firebase/auth at the top level
vi.mock("firebase/auth", () => ({
  getAuth: vi.fn(() => ({
    get currentUser() {
      return authCurrentUser;
    },
  })),
  GoogleAuthProvider: vi.fn(),
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
}));

// Import after mocking
import { getToken, invalidateToken } from "./firebase";

describe("Firebase Token Caching", () => {
  beforeEach(() => {
    // Reset mocks and state
    mockGetIdToken.mockReset();
    vi.clearAllMocks();
    invalidateToken(); // Clear any cached state
  });

  afterEach(() => {
    // Always clean up
    invalidateToken();
    authCurrentUser = null;
  });

  const setUserAuthenticated = () => {
    authCurrentUser = mockCurrentUser;
  };

  const setUserUnauthenticated = () => {
    authCurrentUser = null;
  };

  describe("getToken", () => {
    it("should return null when no user is authenticated", async () => {
      // Arrange
      setUserUnauthenticated();

      // Act
      const token = await getToken();

      // Assert
      expect(token).toBeNull();
      expect(mockGetIdToken).not.toHaveBeenCalled();
    });

    it("should fetch a new token on first call when cache is empty", async () => {
      // Arrange
      const mockToken = "new-firebase-token-123";
      mockGetIdToken.mockResolvedValue(mockToken);
      setUserAuthenticated();

      // Act
      const token = await getToken();

      // Assert
      expect(token).toBe(mockToken);
      expect(mockGetIdToken).toHaveBeenCalledWith(true); // forceRefresh = true
    });

    it("should return cached token on subsequent calls within expiry window", async () => {
      // Arrange
      const mockToken = "cached-firebase-token-456";
      mockGetIdToken.mockResolvedValue(mockToken);
      setUserAuthenticated();

      // Act - First call
      const token1 = await getToken();
      // Second call immediately (should use cache)
      const token2 = await getToken();

      // Assert
      expect(token1).toBe(mockToken);
      expect(token2).toBe(mockToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1); // Only called once
    });

    it("should force refresh token when forceRefresh parameter is true", async () => {
      // Arrange
      const firstToken = "first-token-789";
      const secondToken = "refreshed-token-101";
      mockGetIdToken
        .mockResolvedValueOnce(firstToken)
        .mockResolvedValueOnce(secondToken);
      setUserAuthenticated();

      // Act
      const token1 = await getToken(); // First call, caches token
      const token2 = await getToken(true); // Force refresh

      // Assert
      expect(token1).toBe(firstToken);
      expect(token2).toBe(secondToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);
      expect(mockGetIdToken).toHaveBeenNthCalledWith(2, true);
    });

    it("should fetch new token when cached token is near expiry (within 5 minutes)", async () => {
      // Arrange
      const firstToken = "expiring-token-202";
      const secondToken = "refreshed-token-303";
      mockGetIdToken
        .mockResolvedValueOnce(firstToken)
        .mockResolvedValueOnce(secondToken);
      setUserAuthenticated();

      // Act
      const token1 = await getToken();

      // Simulate time passing to within 5 minutes of expiry
      // Token expiry is set to 1 hour from now, so we need to mock Date.now()
      const originalDateNow = Date.now;
      const tokenFetchTime = originalDateNow();
      // Set time to 56 minutes later (within 5 min threshold)
      vi.spyOn(Date, "now").mockReturnValue(
        tokenFetchTime + 56 * 60 * 1000 + 1,
      );

      const token2 = await getToken();

      // Assert
      expect(token1).toBe(firstToken);
      expect(token2).toBe(secondToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);

      // Restore Date.now
      vi.spyOn(Date, "now").mockRestore();
    });

    it("should not fetch new token when cached token is still valid (more than 5 minutes remaining)", async () => {
      // Arrange
      const mockToken = "valid-token-404";
      mockGetIdToken.mockResolvedValue(mockToken);
      setUserAuthenticated();

      // Act
      const token1 = await getToken();

      // Simulate time passing but still within valid window (e.g., 30 minutes)
      const originalDateNow = Date.now;
      vi.spyOn(Date, "now").mockReturnValue(originalDateNow() + 30 * 60 * 1000);

      const token2 = await getToken();

      // Assert
      expect(token1).toBe(mockToken);
      expect(token2).toBe(mockToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1); // Cache used

      // Restore Date.now
      vi.spyOn(Date, "now").mockRestore();
    });
  });

  describe("invalidateToken", () => {
    it("should clear the cached token", async () => {
      // Arrange
      const firstToken = "token-to-invalidate-505";
      const secondToken = "new-token-after-invalidate-606";
      mockGetIdToken
        .mockResolvedValueOnce(firstToken)
        .mockResolvedValueOnce(secondToken);
      setUserAuthenticated();

      // Act
      const token1 = await getToken(); // Cache the token
      invalidateToken(); // Clear cache
      const token2 = await getToken(); // Should fetch new token

      // Assert
      expect(token1).toBe(firstToken);
      expect(token2).toBe(secondToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    });

    it("should allow force refresh after invalidation", async () => {
      // Arrange
      const firstToken = "first-token-707";
      const secondToken = "second-token-808";
      mockGetIdToken
        .mockResolvedValueOnce(firstToken)
        .mockResolvedValueOnce(secondToken);
      setUserAuthenticated();

      // Act
      await getToken(); // Cache first token
      invalidateToken(); // Clear cache
      const token2 = await getToken(true); // Force refresh

      // Assert
      expect(token2).toBe(secondToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);
    });
  });

  describe("Integration scenarios", () => {
    it("should handle the complete token lifecycle correctly", async () => {
      // Arrange
      const tokens = ["token-1", "token-2", "token-3", "token-4"];
      mockGetIdToken
        .mockResolvedValueOnce(tokens[0])
        .mockResolvedValueOnce(tokens[1])
        .mockResolvedValueOnce(tokens[2])
        .mockResolvedValueOnce(tokens[3]);
      setUserAuthenticated();

      // Act & Assert
      // 1. Initial fetch
      const t1 = await getToken();
      expect(t1).toBe(tokens[0]);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // 2. Cached response
      const t2 = await getToken();
      expect(t2).toBe(tokens[0]);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);

      // 3. Invalidate and fetch new
      invalidateToken();
      const t3 = await getToken();
      expect(t3).toBe(tokens[1]);
      expect(mockGetIdToken).toHaveBeenCalledTimes(2);

      // 4. Force refresh
      const t4 = await getToken(true);
      expect(t4).toBe(tokens[2]);
      expect(mockGetIdToken).toHaveBeenCalledTimes(3);

      // 5. Cached again
      const t5 = await getToken();
      expect(t5).toBe(tokens[2]);
      expect(mockGetIdToken).toHaveBeenCalledTimes(3);
    });

    it("should handle multiple invalidate calls safely", async () => {
      // Arrange
      const mockToken = "safe-token-909";
      mockGetIdToken.mockResolvedValue(mockToken);
      setUserAuthenticated();

      // Act - Multiple invalidations without any get calls
      invalidateToken();
      invalidateToken();
      invalidateToken();

      const token = await getToken();

      // Assert
      expect(token).toBe(mockToken);
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
    });

    it("should handle user becoming unauthenticated", async () => {
      // Arrange
      const mockToken = "authenticated-token";
      mockGetIdToken.mockResolvedValue(mockToken);
      setUserAuthenticated();

      // Act - User is authenticated, get token
      const token1 = await getToken();
      expect(token1).toBe(mockToken);

      // User becomes unauthenticated
      setUserUnauthenticated();
      invalidateToken(); // Clear cache
      const token2 = await getToken();

      // Assert
      expect(token2).toBeNull();
    });
  });
});
