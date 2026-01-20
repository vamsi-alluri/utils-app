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

/**
 * Retrieves the current user's ID token.
 * This handles token refreshing automatically if the current one is expired.
 */
export const getToken = async () => {
  if (!auth.currentUser) return null;
  return await auth.currentUser.getIdToken();
};
