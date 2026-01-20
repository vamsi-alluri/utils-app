import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, loginWithGoogle } from "@/helpers/firebase";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) return <div>Loading...</div>;

  if (!user) {
    return (
      <div style={{ textAlign: "center", marginTop: "50px" }}>
        <h1>Welcome to UTILS</h1>
        <p>Please sign in to access the tools.</p>
        <button onClick={loginWithGoogle} style={{ padding: "10px 20px" }}>
          Sign in with Google
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
