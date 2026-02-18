import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { config } from "@/config";

const firebaseApp = initializeApp(config.firebase);

export const auth = getAuth(firebaseApp);
export const provider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, provider);
export const logout = () => signOut(auth);

// Token cache to minimize unnecessary refreshes
let cachedToken: string | null = null;
let tokenExpiryTime: number | null = null;
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiry

/**
 * Retrieves the current user's ID token with smart caching.
 * - Caches token for 1 hour (Firebase token lifetime)
 * - Forces refresh if token is within 5 minutes of expiry
 * - Supports manual forceRefresh for retry scenarios
 */
export const getToken = async (
  forceRefresh = false,
): Promise<string | null> => {
  if (!auth.currentUser) return null;

  const now = Date.now();
  const needsRefresh =
    forceRefresh ||
    !cachedToken ||
    !tokenExpiryTime ||
    tokenExpiryTime - now < TOKEN_REFRESH_THRESHOLD;

  if (needsRefresh) {
    cachedToken = await auth.currentUser.getIdToken(true);
    // Firebase tokens expire after 1 hour
    tokenExpiryTime = now + 60 * 60 * 1000;
  }

  return cachedToken;
};

/**
 * Invalidates the cached token. Use this when auth fails to force a refresh on next request.
 */
export const invalidateToken = () => {
  cachedToken = null;
  tokenExpiryTime = null;
};
