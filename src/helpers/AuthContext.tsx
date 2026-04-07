import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth, provider } from "@/helpers/firebase";

interface AuthContextType {
  user: User | null;
  /** True after the first onAuthStateChanged callback fires (Firebase is ready). */
  firebaseReady: boolean;
  /** Idempotent — safe to call multiple times. Triggers lazy Firebase init. */
  initAuth: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseReady: false,
  initAuth: () => {},
  loginWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const subscribed = useRef(false);

  // Intentionally not unsubscribed — stays active for the app lifetime so
  // the user state persists in the navbar even after leaving a protected route.
  const initAuth = useCallback(() => {
    if (subscribed.current) return;
    subscribed.current = true;
    onAuthStateChanged(getFirebaseAuth(), (currentUser) => {
      setUser(currentUser);
      setFirebaseReady(true);
    });
  }, []);

  const loginWithGoogle = useCallback(async () => {
    initAuth();
    await signInWithPopup(getFirebaseAuth(), provider);
  }, [initAuth]);

  const logout = useCallback(async () => {
    await signOut(getFirebaseAuth());
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseReady, initAuth, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
