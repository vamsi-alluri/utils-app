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
  Image as ImageIcon,
  Settings,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDocument } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- Types ---

interface PdfPage {
  id: string;
  sourceFileName: string;
  sourceColor: string;
  pageNumber: number; // 1-based
  type: "pdf" | "image";
  thumbnailDataUrl: string;
}

interface UploadedFile {
  fileName: string;
  color: string;
  pageCount: number;
  file: File;
  type: "pdf" | "image";
}

// --- Constants ---

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

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
  Fit: [0, 0], // Special case: Page size = Image size
};

type PageSizeKey = keyof typeof PAGE_SIZES;

export default function MergePdfs() {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scale, setScale] = useState(15);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [outputFileName, setOutputFileName] = useState("merged-document");

  // --- Image Settings State ---
  const [imgPageSize, setImgPageSize] = useState<PageSizeKey>("A4");
  const [imgOrientation, setImgOrientation] = useState<
    "portrait" | "landscape"
  >("portrait");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Helper: Generate Default Filename ---
  const generateDefaultFileName = (currentFiles: UploadedFile[]) => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);
    const defaultName = `merged-doc-${timestamp}`;

    if (currentFiles.length === 2) {
      const name1 = currentFiles[0].fileName.replace(
        /\.(pdf|png|jpg|jpeg)$/i,
        "",
      );
      const name2 = currentFiles[1].fileName.replace(
        /\.(pdf|png|jpg|jpeg)$/i,
        "",
      );
      const combinedName = `merged-${name1}-${name2}`;
      if (combinedName.length <= 200) return combinedName;
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

  const handleUploadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  const handleFilenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (pages.length > 0 && !isMerging && !isProcessing) {
        mergePdfs();
      }
    }
  };

  const addFiles = async (files: File[]) => {
    setError("");
    setIsProcessing(true);

    const newUploadedFiles: UploadedFile[] = [];
    const newPages: PdfPage[] = [];
    let count = uploadedFiles.length;

    for (const file of files) {
      count++;
      const color = COLORS[count % COLORS.length];
      const isPdf = file.type === "application/pdf";
      const isImage = file.type === "image/jpeg" || file.type === "image/png";

      if (!isPdf && !isImage) {
        setError(
          "Skipped unsupported file. Only PDF, PNG, and JPG are allowed.",
        );
        continue;
      }

      try {
        if (isPdf) {
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer })
            .promise;
          const numPages = pdfDoc.numPages;

          newUploadedFiles.push({
            fileName: file.name,
            color,
            pageCount: numPages,
            file,
            type: "pdf",
          });

          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1.0 });
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
              type: "pdf",
              thumbnailDataUrl: canvas.toDataURL(),
            });
          }
        } else {
          const objectUrl = URL.createObjectURL(file);
          newUploadedFiles.push({
            fileName: file.name,
            color,
            pageCount: 1,
            file,
            type: "image",
          });

          newPages.push({
            id: `${Date.now()}-${Math.random()}-img`,
            sourceFileName: file.name,
            sourceColor: color,
            pageNumber: 1,
            type: "image",
            thumbnailDataUrl: objectUrl,
          });
        }
      } catch (err) {
        console.error("Error processing file:", err);
        setError(`Failed to process ${file.name}`);
      }
    }

    setPages((prev) => [...prev, ...newPages]);
    const allUploaded = [...uploadedFiles, ...newUploadedFiles];
    setUploadedFiles(allUploaded);
    setOutputFileName(generateDefaultFileName(allUploaded));
    setIsProcessing(false);
  };

  const removePage = (id: string) => {
    setPages((prev) => prev.filter((page) => page.id !== id));
  };

  const clearAll = () => {
    setPages([]);
    setUploadedFiles([]);
    setOutputFileName("merged-document");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Drag and Drop Reordering ---
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

  // --- Merge Logic ---

  const mergePdfs = async () => {
    if (pages.length === 0) return;
    setIsMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();
      const sourcePdfCache = new Map<string, PDFDocument>();

      for (const page of pages) {
        const sourceFileObj = uploadedFiles.find(
          (u) => u.fileName === page.sourceFileName,
        );
        if (!sourceFileObj) continue;

        if (page.type === "pdf") {
          let sourcePdf = sourcePdfCache.get(page.sourceFileName);
          if (!sourcePdf) {
            const arrayBuffer = await sourceFileObj.file.arrayBuffer();
            sourcePdf = await PDFDocument.load(arrayBuffer);
            sourcePdfCache.set(page.sourceFileName, sourcePdf);
          }
          const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [
            page.pageNumber - 1,
          ]);
          mergedPdf.addPage(copiedPage);
        } else if (page.type === "image") {
          const arrayBuffer = await sourceFileObj.file.arrayBuffer();
          let embeddedImage;
          if (sourceFileObj.file.type === "image/png") {
            embeddedImage = await mergedPdf.embedPng(arrayBuffer);
          } else {
            embeddedImage = await mergedPdf.embedJpg(arrayBuffer);
          }

          const imgDims = embeddedImage.scale(1);
          let pageWidth, pageHeight;

          if (imgPageSize === "Fit") {
            pageWidth = imgDims.width;
            pageHeight = imgDims.height;
          } else {
            const rawSize = PAGE_SIZES[imgPageSize];
            if (imgOrientation === "landscape") {
              pageWidth = rawSize[1];
              pageHeight = rawSize[0];
            } else {
              pageWidth = rawSize[0];
              pageHeight = rawSize[1];
            }
          }

          const newPage = mergedPdf.addPage([pageWidth, pageHeight]);

          if (imgPageSize === "Fit") {
            newPage.drawImage(embeddedImage, {
              x: 0,
              y: 0,
              width: pageWidth,
              height: pageHeight,
            });
          } else {
            const margin = 20;
            const maxWidth = pageWidth - margin * 2;
            const maxHeight = pageHeight - margin * 2;
            const scaleFactor = Math.min(
              maxWidth / imgDims.width,
              maxHeight / imgDims.height,
            );
            const drawWidth = imgDims.width * scaleFactor;
            const drawHeight = imgDims.height * scaleFactor;
            const x = (pageWidth - drawWidth) / 2;
            const y = (pageHeight - drawHeight) / 2;

            newPage.drawImage(embeddedImage, {
              x,
              y,
              width: drawWidth,
              height: drawHeight,
            });
          }
        }
      }

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
      setError("Failed to merge. Please try again.");
      setIsMerging(false);
    }
  };

  const hasImages = uploadedFiles.some((f) => f.type === "image");

  return (
    <div className="max-w-7xl mx-auto mt-10 px-4">
      <Link
        to="/pdf"
        className="text-sm text-blue-600 hover:underline mb-4 block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main Column */}
        <div className="flex-1 w-full bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
            Merge PDFs & Images
          </h1>
          <p className="text-gray-500 mb-8 text-center">
            Upload PDFs or Images, reorder pages, and merge into one document.
          </p>

          {/* Upload Zone - Keyboard Accessible */}
          <div
            tabIndex={0}
            role="button"
            aria-label="Upload PDF or Image files"
            onKeyDown={handleUploadKeyDown}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer mb-6 outline-none
              focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${error ? "border-red-300 bg-red-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-blue-400"}
            `}
          >
            <div className="flex flex-col items-center">
              <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
                <UploadCloud size={48} />
              </div>
              <span className="block text-sm font-medium text-gray-700">
                Click to upload files
              </span>
              <span className="block text-xs text-gray-400 mt-1">
                PDF, JPG, PNG supported
              </span>
              {pages.length > 0 && (
                <span className="block text-sm text-blue-600 font-medium mt-2">
                  {pages.length} page{pages.length > 1 ? "s" : ""} from{" "}
                  {uploadedFiles.length} file
                  {uploadedFiles.length > 1 ? "s" : ""}
                </span>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="application/pdf,image/png,image/jpeg"
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
              <p className="text-sm text-gray-600 mt-2">Processing files...</p>
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
                  max="50"
                  value={scale}
                  onChange={(e) => setScale(Number(e.target.value))}
                  className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <ZoomIn size={18} className="text-gray-500" />
              </div>
              <button
                onClick={clearAll}
                className="text-sm text-red-600 hover:text-red-700 font-medium focus:outline-none focus:underline"
              >
                Clear All
              </button>
            </div>
          )}

          {/* Grid */}
          {pages.length > 0 && (
            <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg min-h-[200px] content-start">
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
                    width: `${scale * 10}px`,
                    borderColor: page.sourceColor,
                  }}
                >
                  <div
                    className="absolute top-2 left-2 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10 shadow-md"
                    style={{ backgroundColor: page.sourceColor }}
                  >
                    {index + 1}
                  </div>
                  <div className="absolute top-2 right-2 z-10 bg-white/90 p-1 rounded-md shadow-sm">
                    {page.type === "image" ? (
                      <ImageIcon size={12} className="text-purple-600" />
                    ) : (
                      <FileText size={12} className="text-blue-600" />
                    )}
                  </div>

                  {/* Remove Btn - Now keyboard accessible (Visible on Focus) */}
                  <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-20">
                    <button
                      onClick={() => removePage(page.id)}
                      className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md focus:outline-none focus:ring-2 focus:ring-red-400"
                      aria-label={`Remove page ${page.pageNumber}`}
                    >
                      <X size={14} />
                    </button>
                  </div>

                  <div className="p-2 h-full flex items-center justify-center bg-gray-100 overflow-hidden">
                    <img
                      src={page.thumbnailDataUrl}
                      alt={`Page ${page.pageNumber}`}
                      className="max-w-full max-h-40 object-contain shadow-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch mt-8">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FileEdit size={18} className="text-gray-400" />
              </div>
              <input
                type="text"
                value={outputFileName}
                onChange={(e) => setOutputFileName(e.target.value)}
                onFocus={(e) => e.target.select()}
                onKeyDown={handleFilenameKeyDown}
                placeholder="Enter file name"
                className="w-full pl-10 pr-12 py-3 border-2 border-gray-300 rounded-lg outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500 text-gray-700"
                disabled={pages.length === 0 || isMerging || isProcessing}
                aria-label="File name"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <span className="text-gray-400 font-medium text-sm">.pdf</span>
              </div>
            </div>
            <button
              onClick={mergePdfs}
              disabled={pages.length === 0 || isMerging || isProcessing}
              className={`
                md:w-auto font-semibold py-3 px-8 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${pages.length === 0 || isMerging || isProcessing ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95"}
              `}
            >
              {isMerging ? (
                "Merging..."
              ) : (
                <>
                  <CheckCircle size={20} /> Merge Files
                </>
              )}
            </button>
          </div>
        </div>

        {/* Right Sidebar: Image Settings */}
        {hasImages && (
          <div className="w-full lg:w-80 shrink-0 bg-blue-50 border border-blue-100 p-6 rounded-2xl animate-fade-in">
            <div className="flex items-center gap-2 mb-4 text-blue-800">
              <Settings size={20} />
              <h2 className="font-semibold">Image Output Settings</h2>
            </div>
            <p className="text-xs text-blue-600 mb-6">
              These settings apply only to image files included in the merge.
              PDF pages retain their original size.
            </p>

            <div className="space-y-5">
              {/* Page Size */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Page Size
                </label>
                <div className="flex flex-col gap-2">
                  {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map((size) => (
                    <label
                      key={size}
                      className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg cursor-pointer hover:border-blue-400 transition-colors focus-within:ring-2 focus-within:ring-blue-500"
                    >
                      <input
                        type="radio"
                        name="pageSize"
                        checked={imgPageSize === size}
                        onChange={() => setImgPageSize(size)}
                        className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">
                        {size === "Fit" ? "Fit to Image Size" : size}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Orientation */}
              {imgPageSize !== "Fit" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Orientation
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setImgOrientation("portrait")}
                      className={`py-2 text-sm rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        imgOrientation === "portrait"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      Portrait
                    </button>
                    <button
                      onClick={() => setImgOrientation("landscape")}
                      className={`py-2 text-sm rounded-lg border transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                        imgOrientation === "landscape"
                          ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      }`}
                    >
                      Landscape
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
