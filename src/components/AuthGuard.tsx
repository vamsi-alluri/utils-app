import { useEffect, useState } from "react";
import { useAuth } from "@/helpers/AuthContext";

interface AuthGuardProps {
  children: React.ReactNode;
  title?: string;
}

export default function AuthGuard({
  children,
  title = "UTILS",
}: AuthGuardProps) {
  const { user, firebaseReady, initAuth, loginWithGoogle } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);

  // Trigger lazy Firebase init when this protected route mounts
  useEffect(() => {
    initAuth();
  }, [initAuth]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await loginWithGoogle();
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        return;
      }
      if (code === "auth/admin-restricted-operation") {
        setAuthError("Sign-ups are currently closed.");
      } else {
        setAuthError("Sign in failed. Please try again.");
      }
    }
  };

  // Firebase initializing — waiting for first onAuthStateChanged callback
  if (!firebaseReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-lg font-medium text-gray-500 animate-pulse">
          Loading {title}...
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-10 shadow-xl text-center border border-gray-100">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
            {title}
          </h1>
          <p className="mt-3 text-gray-500">
            This tool requires authentication. <br />
            Please sign in to continue.
          </p>
          <button
            onClick={handleSignIn}
            className="mt-8 inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 w-full"
          >
            Sign in to access
          </button>
          {authError && (
            <p className="mt-3 text-xs text-red-500">{authError}</p>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
