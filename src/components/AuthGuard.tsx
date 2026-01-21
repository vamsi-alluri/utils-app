import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, loginWithGoogle } from "@/helpers/firebase";

// 1. Update the interface to accept an optional 'title' string
interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
}

export default function AuthGuard({
  children,
  title = "UTILS",
}: AuthGuardProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-lg font-medium text-gray-500 animate-pulse">
          Loading {title}...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center border border-gray-100">
          {/* 2. Use the 'title' prop here */}
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {title}
          </h1>

          <p className="mt-3 text-gray-500">
            This tool requires authentication. <br />
            Please sign in to continue.
          </p>

          <button
            onClick={loginWithGoogle}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full"
          >
            Sign in to access
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
