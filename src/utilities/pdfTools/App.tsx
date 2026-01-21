import { lazy } from "react";
import { Routes, Route } from "react-router-dom";

// Lazy load individual PDF tool pages
const PdfHome = lazy(() => import("./pages/pdfHome"));
const JpgToPdf = lazy(() => import("./pages/jpgToPdf"));
const PdfToJpg = lazy(() => import("./pages/pdfToJpg"));

export default function PdfToolsApp() {
  // REMOVED: Suspense and LoadingFallback
  // The parent App.tsx Suspense will catch these lazy loads now.
  return (
    <Routes>
      <Route path="/" element={<PdfHome />} />
      <Route path="/j2p" element={<JpgToPdf />} />
      <Route path="/p2j" element={<PdfToJpg />} />
    </Routes>
  );
}
