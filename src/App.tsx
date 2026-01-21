import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { logout } from "@/helpers/firebase";

// Lazy load utility modules - only load when route is accessed
const JdScreener = lazy(() => import("@/utilities/jdScreener/App"));
const PdfTools = lazy(() => import("@/utilities/pdfTools/App"));

// Loading fallback component
function LoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 text-sm">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 font-sans text-gray-900">
        <nav className="sticky top-0 z-50 flex items-center gap-8 bg-white px-6 py-4 shadow-sm border-b border-gray-200">
          <strong className="text-xl font-extrabold tracking-tight text-blue-600">
            UTILS
          </strong>
          <div className="flex items-center gap-6 text-sm font-medium text-gray-600">
            <Link to="/" className="hover:text-blue-600 transition-colors">
              Home
            </Link>
            <Link
              to="/jd-screener"
              className="hover:text-blue-600 transition-colors"
            >
              JD Screener
            </Link>
            <Link to="/pdf" className="hover:text-blue-600 transition-colors">
              PDF Tools
            </Link>
          </div>
          <button
            onClick={logout}
            className="ml-auto rounded-lg bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 hover:text-red-700 transition-all"
          >
            Logout
          </button>
        </nav>
        <main className="container mx-auto max-w-7xl p-6">
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route
                path="/"
                element={
                  <div className="mt-20 text-center">
                    <h1 className="text-4xl font-bold text-gray-800">
                      Dashboard
                    </h1>
                  </div>
                }
              />
              <Route path="/jd-screener" element={<JdScreener />} />
              <Route path="/pdf/*" element={<PdfTools />} />
            </Routes>
          </Suspense>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
