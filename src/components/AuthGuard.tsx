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

  // 1. Loading State: Centered spinner/text
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-500 animate-pulse">
          Loading UTILS...
        </div>
      </div>
    );
  }

  // 2. Unauthenticated State: Login Card
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center border border-gray-100">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            Welcome to UTILS
          </h1>

          <p className="mt-3 text-gray-500">
            Secure access to developer productivity tools. <br />
            Please sign in to continue.
          </p>

          <button
            onClick={loginWithGoogle}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  // 3. Authenticated State: Render Children
  return <>{children}</>;
}
