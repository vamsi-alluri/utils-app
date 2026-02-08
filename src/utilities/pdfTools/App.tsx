import { lazy } from "react";
import { Routes, Route } from "react-router-dom";
import SuspenseWithProgress from "@/components/SuspenseWithProgress";
import Loader from "@/components/Loader";

// Lazy load individual PDF tool pages
const PdfHome = lazy(() => import("./pages/pdfHome"));
const JpgToPdf = lazy(() => import("./pages/jpgToPdf"));
const PdfToJpg = lazy(() => import("./pages/pdfToJpg"));
const MergePdfs = lazy(() => import("./pages/MergePdfs"));

export default function PdfToolsApp() {
  return (
    <SuspenseWithProgress theme="blue" fallback={<Loader text="Loading..." />}>
      <Routes>
        <Route path="/" element={<PdfHome />} />
        <Route path="/j2p" element={<JpgToPdf />} />
        <Route path="/p2j" element={<PdfToJpg />} />
        <Route path="/mergePdfs" element={<MergePdfs />} />
      </Routes>
    </SuspenseWithProgress>
  );
}
