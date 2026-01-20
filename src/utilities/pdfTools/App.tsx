// src/utilities/pdfTools/App.tsx

import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

// Lazy load individual PDF tool pages
const PdfHome = lazy(() => import("./pages/pdfHome"));
const JpgToPdf = lazy(() => import("./pages/jpgToPdf"));
const PdfToJpg = lazy(() => import("./pages/pdfToJpg"));

// Loading fallback for PDF tools
function PdfLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
        <p className="text-gray-600 text-sm">Loading PDF tool...</p>
      </div>
    </div>
  );
}

export default function PdfToolsApp() {
  return (
    <Suspense fallback={<PdfLoadingFallback />}>
      <Routes>
        <Route path="/" element={<PdfHome />} />
        <Route path="/j2p" element={<JpgToPdf />} />
        <Route path="/p2j" element={<PdfToJpg />} />
      </Routes>
    </Suspense>
  );
}
