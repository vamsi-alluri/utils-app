import { Link } from "react-router-dom";
import { Upload } from "griddy-icons";

export default function PdfToJpg() {
  return (
    <div className="max-w-2xl mx-auto mt-10">
      {/* Breadcrumb */}
      <Link
        to="/pdf"
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">PDF to JPG</h1>
        <p className="text-gray-500 mb-8">
          Turn PDF pages into a ZIP of images.
        </p>

        {/* Upload Zone Skeleton */}
        <div className="border-2 border-dashed border-gray-300 rounded-xl p-12 bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer">
          <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
            <Upload size={48} />
          </div>
          <span className="block text-sm font-medium text-gray-700">
            Click to upload PDF
          </span>
          <span className="block text-xs text-gray-400 mt-1">
            Multi-page PDFs supported
          </span>

          {/* Hidden Input for Logic Later */}
          <input type="file" className="hidden" accept="application/pdf" />
        </div>

        {/* Action Button Skeleton */}
        <button
          disabled
          className="mt-6 w-full bg-blue-600 text-white font-semibold py-3 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all"
        >
          Convert to JPGs
        </button>
      </div>
    </div>
  );
}
