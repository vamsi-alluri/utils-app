import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  X,
  Download,
  FileImage,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import JSZip from "jszip";

// --- Worker Configuration (Local / Self-Hosted) ---
// We point to the file in the public folder.
// This assumes you have copied 'pdf.worker.min.js' from node_modules into your 'public/' folder.
pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

interface PdfPage {
  id: string;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  blob: Blob | null;
}

export default function PdfToJpg() {
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [scale, setScale] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState(0.92);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const validateAndSetFile = async (selectedFile: File) => {
    setError("");
    if (selectedFile.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
    await processPdf(selectedFile);
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    setPages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- PDF Processing ---

  const processPdf = async (pdfFile: File) => {
    setIsProcessing(true);
    setError("");

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();

      // Load the document.
      // Note: We use 'pdfjsLib.getDocument' directly.
      // Since workerSrc is set globally above, it will fetch the worker from the public folder.
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;

      const numPages = pdfDoc.numPages;
      const newPages: PdfPage[] = [];

      for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);

        // Render at a higher scale (2x) for sharp quality
        const viewport = page.getViewport({ scale: 2 });

        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) throw new Error("Could not get canvas context");

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport, canvas }).promise;

        newPages.push({
          id: `page-${pageNum}`,
          pageNumber: pageNum,
          canvas,
          blob: null,
        });
      }

      setPages(newPages);
      setIsProcessing(false);
    } catch (err) {
      console.error("Error processing PDF:", err);
      // Detailed error message to help debug if the file move didn't work
      setError(
        "Failed to process PDF. Please check that 'pdf.worker.min.js' is in your public folder.",
      );
      setIsProcessing(false);
    }
  };

  // --- Conversion to JPG and ZIP ---

  const convertToJpgs = async () => {
    if (pages.length === 0 || !file) return;
    setIsConverting(true);

    try {
      const zip = new JSZip();
      const baseName = file.name.replace(/\.pdf$/i, "");

      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        const blob = await new Promise<Blob>((resolve, reject) => {
          page.canvas.toBlob(
            (blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Failed to convert page to blob"));
            },
            "image/jpeg",
            quality,
          );
        });

        const pageNum = String(page.pageNumber).padStart(3, "0");
        zip.file(`${baseName}_page_${pageNum}.jpg`, blob);
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });

      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${baseName}_images.zip`;
      a.click();
      URL.revokeObjectURL(url);

      setIsConverting(false);
    } catch (err) {
      console.error("Error converting to JPGs:", err);
      setError("Failed to convert pages to JPG.");
      setIsConverting(false);
    }
  };

  const thumbnailSize = scale;

  return (
    <div className="max-w-6xl mx-auto mt-10 px-4">
      <Link
        to="/pdf"
        className="text-sm text-blue-600 hover:underline mb-4 block"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          PDF to JPG
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          Convert PDF pages into a ZIP file of high-quality JPG images.
        </p>

        {/* --- Upload Zone --- */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer mb-6
            ${error ? "border-red-300 bg-red-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400"}
          `}
        >
          {file ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="h-16 w-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-4">
                <FileImage size={32} />
              </div>
              <span className="text-lg font-medium text-gray-800 break-all">
                {file.name}
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>
              {pages.length > 0 && (
                <span className="text-sm text-blue-600 font-medium mt-2">
                  {pages.length} page{pages.length > 1 ? "s" : ""} detected
                </span>
              )}

              <button
                onClick={clearFile}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors"
                title="Remove file"
              >
                <X size={24} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
                <UploadCloud size={48} />
              </div>
              <span className="block text-sm font-medium text-gray-700">
                Click to upload PDF
              </span>
              <span className="block text-xs text-gray-400 mt-1">
                or drag and drop here
              </span>
            </div>
          )}

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="application/pdf"
            onChange={handleFileSelect}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 font-medium text-center">
            {error}
          </p>
        )}

        {isProcessing && (
          <div className="text-center mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Processing PDF...</p>
          </div>
        )}

        {/* --- Controls Row --- */}
        {pages.length > 0 && !isProcessing && (
          <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
            {/* Quality Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                Quality:
              </span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setQuality(0.7)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    quality === 0.7
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Low
                </button>
                <button
                  onClick={() => setQuality(0.85)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    quality === 0.85
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Medium
                </button>
                <button
                  onClick={() => setQuality(0.92)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    quality === 0.92
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  High
                </button>
              </div>
            </div>

            {/* Scale Slider */}
            <div className="flex items-center gap-3">
              <ZoomOut size={18} className="text-gray-500" />
              <input
                type="range"
                min="10"
                max="100"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
              />
              <ZoomIn size={18} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-600 min-w-12">
                {scale}%
              </span>
            </div>
          </div>
        )}

        {/* --- Pages Preview Grid --- */}
        {pages.length > 0 && !isProcessing && (
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            {pages.map((page) => (
              <div
                key={page.id}
                className="relative bg-white rounded-lg shadow-sm border-2 border-gray-200 shrink-0"
                style={{
                  width: `calc(${thumbnailSize}% - 1rem)`,
                  minWidth: "64px",
                }}
              >
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
                  {page.pageNumber}
                </div>

                <div className="p-2">
                  <img
                    src={page.canvas.toDataURL("image/jpeg", 0.8)}
                    alt={`Page ${page.pageNumber}`}
                    className="w-full h-auto object-contain rounded"
                  />
                </div>

                <div className="px-2 pb-2 text-xs text-gray-600 text-center">
                  Page {page.pageNumber}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Action Button --- */}
        <button
          onClick={convertToJpgs}
          disabled={pages.length === 0 || isConverting || isProcessing}
          className={`
            w-full font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2
            ${
              pages.length === 0 || isConverting || isProcessing
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95"
            }
          `}
        >
          {isConverting ? (
            <>
              Converting {pages.length} page{pages.length > 1 ? "s" : ""}...
            </>
          ) : (
            <>
              {pages.length > 0 && <Download size={20} />}
              Download as ZIP ({pages.length} JPG{pages.length > 1 ? "s" : ""})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
