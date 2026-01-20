import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import AuthGuard from "@/components/AuthGuard";
import JdScreener from "@/utilities/jdScreener/App";
import PdfTools from "@/utilities/pdfTools/App";
import { logout } from "@/helpers/firebase";

function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
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
              {/* Changed link to /pdf */}
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

              {/* IMPORTANT: Added /* to match sub-routes like /pdf/j2p */}
              <Route path="/pdf/*" element={<PdfTools />} />
            </Routes>
          </main>
        </div>
      </AuthGuard>
    </BrowserRouter>
  );
}

export default App;
