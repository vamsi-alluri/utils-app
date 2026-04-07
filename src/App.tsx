import { lazy, useState } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "@/helpers/AuthContext";
import AuthGuard from "@/components/AuthGuard";
import Footer from "@/components/Footer";
import Loader from "@/components/Loader";
import SuspenseWithProgress from "@/components/SuspenseWithProgress";
import {
  User as UserIcon,
  FileText,
  Image as ImageIcon,
  Sparkles,
  Shield,
} from "lucide-react";
import { SpeedInsights } from "@vercel/speed-insights/react";

const JdScreener = lazy(() => import("@/utilities/jdScreener/App"));
const PdfTools = lazy(() => import("@/utilities/pdfTools/App"));
const ImageTools = lazy(() => import("@/utilities/imageTools/App"));
const Privacy = lazy(() => import("@/pages/Privacy"));
const Terms = lazy(() => import("@/pages/Terms"));

function HomePage() {
  const { user } = useAuth();
  return (
    <div className="max-w-2xl mx-auto pt-12 pb-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Browser-native tools
        </h1>
        <p className="text-gray-500">
          Everything runs locally — no uploads, no tracking.
        </p>
        {user && (
          <p className="text-sm text-gray-400 mt-2">
            Welcome back, {user.displayName?.split(" ")[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          to="/pdf"
          className="p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="p-2 bg-red-50 rounded-lg w-fit mb-3">
            <FileText className="w-5 h-5 text-red-500" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">PDF Tools</div>
          <p className="text-sm text-gray-500">Merge, split, convert PDF ↔ JPG</p>
        </Link>

        <Link
          to="/image"
          className="p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="p-2 bg-purple-50 rounded-lg w-fit mb-3">
            <ImageIcon className="w-5 h-5 text-purple-500" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">Image Tools</div>
          <p className="text-sm text-gray-500">Crop and resize with precision</p>
        </Link>

        <Link
          to="/jd-screener"
          className="p-6 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
        >
          <div className="p-2 bg-blue-50 rounded-lg w-fit mb-3">
            <Sparkles className="w-5 h-5 text-blue-500" />
          </div>
          <div className="font-semibold text-gray-900 mb-1">
            JD Screener{" "}
            <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">
              Auth
            </span>
          </div>
          <p className="text-sm text-gray-500">AI job description analysis</p>
        </Link>
      </div>

      <div className="flex items-center justify-center gap-1.5 mt-8 text-xs text-gray-400">
        <Shield className="w-3 h-3" />
        <span>Files never leave your device · No cookies · No tracking</span>
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loginWithGoogle, logout } = useAuth();
  const [authError, setAuthError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState(false);

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

  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 flex items-center gap-8 bg-white px-6 py-4 shadow-sm border-b border-gray-200">
          <Link
            to="/"
            className="text-xl font-extrabold tracking-tight text-blue-600"
          >
            UTILS
          </Link>

          <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link
              to="/jd-screener"
              className="hover:text-blue-600 transition-colors"
            >
              JD Screener{" "}
              <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded ml-1">
                Auth
              </span>
            </Link>
            <Link to="/pdf" className="hover:text-blue-600 transition-colors">
              PDF Tools
            </Link>
            <Link to="/image" className="hover:text-blue-600 transition-colors">
              Image Tools
            </Link>
          </div>

          {/* Right side: auth state */}
          <div className="ml-auto flex flex-col items-end gap-1">
            <div className="flex items-center gap-4">
              {user ? (
                <>
                  {user.photoURL && !photoError ? (
                    <img
                      src={user.photoURL}
                      alt="Profile"
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-gray-200 shadow-sm object-cover"
                      title={user.displayName || "User"}
                      onError={() => setPhotoError(true)}
                    />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-500">
                      <UserIcon className="w-5 h-5" />
                    </div>
                  )}
                  <button
                    onClick={logout}
                    className="rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 hover:text-red-700 transition-all"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={handleSignIn}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-sm transition-all"
                >
                  Sign In
                </button>
              )}
            </div>
            {authError && (
              <p className="text-xs text-red-500">{authError}</p>
            )}
          </div>
        </nav>

        {/* Main content */}
        <main className="container w-[90%] mx-auto p-6 grow">
          <SuspenseWithProgress
            theme="blue"
            fallback={<Loader text="Loading Application..." />}
          >
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/pdf/*" element={<PdfTools />} />
              <Route path="/image/*" element={<ImageTools />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route
                path="/jd-screener"
                element={
                  <AuthGuard title="JD Screener Bot">
                    <JdScreener />
                  </AuthGuard>
                }
              />
            </Routes>
          </SuspenseWithProgress>
        </main>

        <Footer />
      </div>
      <SpeedInsights />
    </BrowserRouter>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
