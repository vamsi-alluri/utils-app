import { Routes, Route } from "react-router-dom";
import PdfHome from "./pages/PdfHome";
import JpgToPdf from "./pages/JpgToPdf";
import PdfToJpg from "./pages/PdfToJpg";

export default function PdfToolsApp() {
  return (
    <div className="max-w-5xl mx-auto">
      <Routes>
        {/* Route: /pdf */}
        <Route index element={<PdfHome />} />

        {/* Route: /pdf/j2p */}
        <Route path="j2p" element={<JpgToPdf />} />

        {/* Route: /pdf/p2j */}
        <Route path="p2j" element={<PdfToJpg />} />
      </Routes>
    </div>
  );
}
