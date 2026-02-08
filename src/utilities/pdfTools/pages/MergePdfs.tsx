import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle,
  X,
  GripVertical,
  ZoomIn,
  ZoomOut,
  FileText,
  FileEdit,
} from "lucide-react";
// We keep pdfjs-dist for generating UI Thumbnails only
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
// Import pdf-lib for vector-based merging
import { PDFDocument } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

interface PdfPage {
  id: string;
  sourceFileName: string;
  sourceColor: string;
  pageNumber: number; // 1-based index (for display and pdfjs)
  totalPages: number;
  canvas: HTMLCanvasElement;
  // We no longer strictly need pdfDoc proxy here for merging,
  // but we keep it if needed for re-rendering thumbnails.
}

interface UploadedPdf {
  fileName: string;
  color: string;
  pageCount: number;
  file: File; // Store the original file for pdf-lib processing
}

const COLORS = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

export default function MergePdfs() {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [uploadedPdfs, setUploadedPdfs] = useState<UploadedPdf[]>([]);
  const [scale, setScale] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [outputFileName, setOutputFileName] = useState("merged-document");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helper: Generate Default Filename ---
  const generateDefaultFileName = (currentPdfs: UploadedPdf[]) => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);
    const defaultName = `merged-doc-${timestamp}`;

    if (currentPdfs.length === 2) {
      const name1 = currentPdfs[0].fileName.replace(/\.pdf$/i, "");
      const name2 = currentPdfs[1].fileName.replace(/\.pdf$/i, "");
      const combinedName = `merged-${name1}-${name2}`;
      if (combinedName.length <= 200) {
        return combinedName;
      }
    }
    return defaultName;
  };

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const addFiles = async (files: File[]) => {
    setError("");
    setIsProcessing(true);

    const newUploadedPdfs: UploadedPdf[] = [];
    let count = uploadedPdfs.length;

    for (const file of files) {
      count++;

      // Strict PDF check for now (Image support coming in Part 2)
      if (file.type !== "application/pdf") {
        setError("Currently only PDF files are allowed.");
        continue;
      }

      try {
        const arrayBuffer = await file.arrayBuffer();

        // 1. Load into PDF.js for UI Thumbnails (Rasterizing for preview only)
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer })
          .promise;
        const numPages = pdfDoc.numPages;
        const color = COLORS[count % COLORS.length];

        // Store file reference for later Vector merging
        const uploadedPdf = {
          fileName: file.name,
          color,
          pageCount: numPages,
          file,
        };
        newUploadedPdfs.push(uploadedPdf);

        // 2. Render Thumbnails
        const newPages: PdfPage[] = [];
        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdfDoc.getPage(pageNum);
          const viewport = page.getViewport({ scale: 1.5 }); // Thumbnail scale

          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d")!;
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({ canvasContext: context, viewport }).promise;

          newPages.push({
            id: `${Date.now()}-${Math.random()}-${pageNum}`,
            sourceFileName: file.name,
            sourceColor: color,
            pageNumber: pageNum,
            totalPages: numPages,
            canvas,
          });
        }

        setPages((prev) => [...prev, ...newPages]);
      } catch (err) {
        console.error("Error processing PDF:", err);
        setError(`Failed to process ${file.name}`);
      }
    }

    const allUploadedPdfs = [...uploadedPdfs, ...newUploadedPdfs];
    setUploadedPdfs(allUploadedPdfs);
    setOutputFileName(generateDefaultFileName(allUploadedPdfs));
    setIsProcessing(false);
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((page) => page.id !== id));
  };

  const clearAll = () => {
    setPages([]);
    setUploadedPdfs([]);
    setOutputFileName("merged-document");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Drag and Drop Logic (Unchanged) ---
  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    const newPages = [...pages];
    const draggedItem = newPages[draggedIndex];
    newPages.splice(draggedIndex, 1);
    newPages.splice(index, 0, draggedItem);
    setPages(newPages);
    setDraggedIndex(index);
  };
  const handleDragEnd = () => setDraggedIndex(null);

  // --- Vector Merge Logic (Powered by pdf-lib) ---

  const mergePdfs = async () => {
    if (pages.length === 0) return;
    setIsMerging(true);

    try {
      // 1. Create a new empty PDF document
      const mergedPdf = await PDFDocument.create();

      // 2. Load all unique source PDFs into memory (to avoid reloading for every page)
      const sourcePdfMap = new Map<string, PDFDocument>();

      // We identify unique files from the currently active pages to ensure consistency
      // (Though we could also just use uploadedPdfs, this is safer if we allow duplicates later)
      const uniqueSourceNames = Array.from(
        new Set(pages.map((p) => p.sourceFileName)),
      );

      for (const fileName of uniqueSourceNames) {
        const sourceFile = uploadedPdfs.find(
          (u) => u.fileName === fileName,
        )?.file;
        if (sourceFile) {
          const arrayBuffer = await sourceFile.arrayBuffer();
          const loadedPdf = await PDFDocument.load(arrayBuffer);
          sourcePdfMap.set(fileName, loadedPdf);
        }
      }

      // 3. Copy pages one by one in the user's sorted order
      for (const page of pages) {
        const sourcePdf = sourcePdfMap.get(page.sourceFileName);
        if (!sourcePdf) continue;

        // pdf-lib uses 0-based index, our UI state uses 1-based
        const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [
          page.pageNumber - 1,
        ]);
        mergedPdf.addPage(copiedPage);
      }

      // 4. Save and Download
      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      let fileName = outputFileName.trim();
      if (!fileName) fileName = `merged-doc-${Date.now()}`;
      if (!fileName.toLowerCase().endsWith(".pdf")) fileName += ".pdf";

      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setIsMerging(false);
    } catch (err) {
      console.error(err);
      setError("Failed to merge PDFs. Please try again.");
      setIsMerging(false);
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
          Merge PDFs
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          Upload multiple PDFs, reorder pages, and merge into one document.
        </p>

        {/* Upload Zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer mb-6
            ${error ? "border-red-300 bg-red-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400"}
          `}
        >
          <div className="flex flex-col items-center">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
              <UploadCloud size={48} />
            </div>
            <span className="block text-sm font-medium text-gray-700">
              Click to upload PDF files
            </span>
            <span className="block text-xs text-gray-400 mt-1">
              or drag and drop multiple files here
            </span>
            {pages.length > 0 && (
              <span className="block text-sm text-blue-600 font-medium mt-2">
                {pages.length} page{pages.length > 1 ? "s" : ""} from{" "}
                {uploadedPdfs.length} PDF{uploadedPdfs.length > 1 ? "s" : ""}
              </span>
            )}
          </div>
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="application/pdf"
            onChange={handleFileSelect}
            multiple
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
            <p className="text-sm text-gray-600 mt-2">Processing PDFs...</p>
          </div>
        )}

        {/* Legend */}
        {uploadedPdfs.length > 0 && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Uploaded Files:
            </h3>
            <div className="flex flex-wrap gap-3">
              {uploadedPdfs.map((pdf, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border-2 shadow-sm"
                  style={{ borderColor: pdf.color }}
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: pdf.color }}
                  ></div>
                  <FileText size={14} className="text-gray-500" />
                  <span className="text-xs font-medium text-gray-700 truncate max-w-xs">
                    {pdf.fileName}
                  </span>
                  <span className="text-xs text-gray-500">
                    ({pdf.pageCount} pages)
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        {pages.length > 0 && (
          <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
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
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
        )}

        {/* Grid */}
        {pages.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            {pages.map((page, index) => (
              <div
                key={page.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  relative group cursor-move bg-white rounded-lg shadow-sm border-4 transition-all shrink-0
                  ${draggedIndex === index ? "opacity-50 scale-105" : "hover:scale-105"}
                `}
                style={{
                  width: `calc(${thumbnailSize}% - 1rem)`,
                  minWidth: "64px",
                  borderColor: page.sourceColor,
                }}
              >
                <div
                  className="absolute top-2 left-2 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10 shadow-md"
                  style={{ backgroundColor: page.sourceColor }}
                >
                  {index + 1}
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => removePage(page.id)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={24} className="text-gray-400" />
                </div>
                <div className="p-2">
                  <img
                    src={page.canvas.toDataURL()}
                    alt={`Page ${page.pageNumber}`}
                    className="w-full h-auto object-contain rounded"
                  />
                </div>
                <div className="px-2 pb-2">
                  <div className="text-xs text-gray-600 truncate font-medium">
                    {page.sourceFileName}
                  </div>
                  <div className="text-xs text-gray-500">
                    Page {page.pageNumber}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Action Bar */}
        <div className="flex flex-col md:flex-row gap-4 items-stretch">
          <div className="relative flex-grow">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FileEdit size={18} className="text-gray-400" />
            </div>
            <input
              type="text"
              value={outputFileName}
              onChange={(e) => setOutputFileName(e.target.value)}
              onFocus={(e) => e.target.select()}
              placeholder="Enter file name"
              className="w-full pl-10 pr-12 py-3 border-2 border-gray-300 rounded-lg outline-none transition-colors focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-gray-700"
              disabled={pages.length === 0 || isMerging || isProcessing}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-400 font-medium text-sm">.pdf</span>
            </div>
          </div>
          <button
            onClick={mergePdfs}
            disabled={pages.length === 0 || isMerging || isProcessing}
            className={`
              md:w-auto font-semibold py-3 px-8 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap
              ${pages.length === 0 || isMerging || isProcessing ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95"}
            `}
          >
            {isMerging ? (
              "Merging..."
            ) : (
              <>
                <CheckCircle size={20} /> Merge PDFs
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
