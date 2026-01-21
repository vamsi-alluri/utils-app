import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth, logout, loginWithGoogle } from "@/helpers/firebase"; // Added loginWithGoogle
import AuthGuard from "@/components/AuthGuard";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import { User as UserIcon } from "lucide-react";

// Lazy load utility modules
const JdScreener = lazy(() => import("@/utilities/jdScreener/App"));
const PdfTools = lazy(() => import("@/utilities/pdfTools/App"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));

function App() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
        {/* --- Navigation Bar (Publicly Visible) --- */}
        <nav className="sticky top-0 z-50 flex items-center gap-8 bg-white px-6 py-4 shadow-sm border-b border-gray-200">
          <Link
            to="/"
            className="text-xl font-extrabold tracking-tight text-blue-600"
          >
            UTILS
          </Link>

          {/* Links are now visible to everyone */}
          <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>

            {/* UX Choice: We show the link, but if they click it
              without being logged in, the AuthGuard will catch them.
            */}
            <Link
              to="/jd-screener"
              className="hover:text-blue-600 transition-colors"
            >
              JD Screener{" "}
              <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded ml-1">
                Auth
              </span>
            </Link>

            <Link to="/pdf" className="hover:text-blue-600 transition-colors">
              PDF Tools
            </Link>
          </div>

          {/* Right Side: Auth State */}
          <div className="ml-auto flex items-center gap-4">
            {user ? (
              // State: Logged In
              <>
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    referrerPolicy="no-referrer"
                    className="h-8 w-8 rounded-full border border-gray-200 shadow-sm object-cover"
                    title={user.displayName || "User"}
                    onError={(e) => {
                      // Fallback to hidden if image fails, showing the icon below instead
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement
                        ?.querySelector(".fallback-icon")
                        ?.classList.remove("hidden");
                    }}
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500">
                    <UserIcon className="w-5 h-5" />
                  </div>
                )}

                {/* Hidden fallback icon that shows if img crashes (Optional but robust) */}
                <div className="fallback-icon hidden h-8 w-8 rounded-full bg-gray-100 items-center justify-center border border-gray-200 text-gray-500">
                  <UserIcon className="w-5 h-5" />
                </div>

                <button
                  onClick={logout}
                  className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 hover:text-red-700 transition-all"
                >
                  Logout
                </button>
              </>
            ) : (
              // State: Guest (Public)
              <button
                onClick={loginWithGoogle}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all"
              >
                Sign In
              </button>
            )}
          </div>
        </nav>

        {/* --- Main Content --- */}
        <main className="container mx-auto max-w-7xl p-6 grow">
          <Suspense fallback={<Loader text="Loading Application..." />}>
            <Routes>
              {/* Public Routes */}
              <Route
                path="/"
                element={
                  <div className="mt-20 text-center">
                    <h1 className="text-4xl font-bold text-gray-800">
                      Dashboard
                    </h1>
                    <p className="text-gray-500 mt-2">
                      {user
                        ? `Welcome back, ${user.displayName}`
                        : "Free developer tools. Sign in for AI features."}
                    </p>
                  </div>
                }
              />

              <Route path="/pdf/*" element={<PdfTools />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />

              {/* Protected Route: JD Screener ONLY */}
              <Route
                path="/jd-screener"
                element={
                  <AuthGuard title="JD Screener Bot">
                    <JdScreener />
                  </AuthGuard>
                }
              />
            </Routes>
          </Suspense>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
