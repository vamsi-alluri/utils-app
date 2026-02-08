import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  CheckCircle,
  X,
  ZoomIn,
  ZoomOut,
  FileText,
  FileEdit,
  Image as ImageIcon,
  Settings,
  Plus,
  RectangleVertical,
  RectangleHorizontal,
  Trash2,
  ChevronDown,
  File as FileIcon,
  Loader2,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDocument } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- Types ---

interface PdfPage {
  id: string; // Unique Page ID
  sourceFileId: string; // Link to the parent UploadedFile
  sourceFileName: string;
  sourceColor: string;
  pageNumber: number; // 1-based
  totalPages: number;
  type: "pdf" | "image";
  thumbnailDataUrl: string;
  width?: number;
  height?: number;
}

interface UploadedFile {
  id: string; // Unique File Batch ID
  fileName: string;
  color: string;
  pageCount: number;
  file: File;
  type: "pdf" | "image";
}

// --- Constants ---

// Expanded Color Pool (12 Colors)
const COLOR_POOL = [
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#EF4444", // Red
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#14B8A6", // Teal
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#84CC16", // Lime
  "#06B6D4", // Cyan
  "#D946EF", // Fuchsia
];

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
  Fit: [0, 0],
  Original: [0, 0],
};

type PageSizeKey = keyof typeof PAGE_SIZES;

interface MergeSettings {
  image: {
    pageSize: "A4" | "Letter" | "Fit";
    orientation: "portrait" | "landscape";
  };
  pdf: {
    pageSize: "Original" | "A4" | "Letter";
  };
}

const DEFAULT_SETTINGS: MergeSettings = {
  image: { pageSize: "A4", orientation: "portrait" },
  pdf: { pageSize: "Original" },
};

// --- Helper: Truncate Filename ---
const truncateFilename = (name: string, maxLength: number = 20) => {
  if (name.length <= maxLength) return name;
  const extIndex = name.lastIndexOf(".");
  const ext = extIndex !== -1 ? name.substring(extIndex) : "";
  const nameNoExt = extIndex !== -1 ? name.substring(0, extIndex) : name;

  const charCount = maxLength - ext.length - 3;
  const start = Math.ceil(charCount / 2);
  const end = Math.floor(charCount / 2);

  return `${nameNoExt.slice(0, start)}...${nameNoExt.slice(-end)}${ext}`;
};

export default function MergePdfs() {
  const [pages, setPages] = useState<PdfPage[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [scale, setScale] = useState(2);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [error, setError] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [outputFileName, setOutputFileName] = useState("merged-document");

  // UI States
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  // Settings State
  const [settings, setSettings] = useState<MergeSettings>(DEFAULT_SETTINGS);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"image" | "pdf">(
    "image",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const hasImages = uploadedFiles.some((f) => f.type === "image");
  const hasPdfs = uploadedFiles.some((f) => f.type === "pdf");
  const hasFiles = pages.length > 0;

  // Close settings when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        settingsRef.current &&
        !settingsRef.current.contains(event.target as Node)
      ) {
        setIsSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Ensure active tab defaults to available type
  useEffect(() => {
    if (hasPdfs && !hasImages && activeSettingsTab === "image") {
      setActiveSettingsTab("pdf");
    } else if (hasImages && !hasPdfs && activeSettingsTab === "pdf") {
      setActiveSettingsTab("image");
    }
  }, [hasImages, hasPdfs, activeSettingsTab]);

  // --- Helper: Get Next Available Color ---
  const getAvailableColor = (currentFiles: UploadedFile[]) => {
    const usedColors = new Set(currentFiles.map((f) => f.color));
    // Find first color in pool not currently used
    const available = COLOR_POOL.find((c) => !usedColors.has(c));
    // If all used, cycle using modulo based on count
    return available || COLOR_POOL[currentFiles.length % COLOR_POOL.length];
  };

  // --- Helper: Generate Filename ---
  const updateFilename = (
    currentPages: PdfPage[],
    allUploadedFiles: UploadedFile[],
  ) => {
    // Check which unique files are still represented in the pages
    const activeFileIds = new Set(currentPages.map((p) => p.sourceFileId));
    const activeFiles = allUploadedFiles.filter((f) => activeFileIds.has(f.id));

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);
    let newName = `merged-doc-${timestamp}`;

    // If exactly 2 files, try to combine names
    if (activeFiles.length === 2) {
      const name1 = activeFiles[0].fileName.replace(
        /\.(pdf|png|jpg|jpeg)$/i,
        "",
      );
      const name2 = activeFiles[1].fileName.replace(
        /\.(pdf|png|jpg|jpeg)$/i,
        "",
      );
      const combinedName = `merged-${name1}-${name2}`;
      if (combinedName.length <= 200) newName = combinedName;
    }
    setOutputFileName(newName);
  };

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  // --- Global Drop Zone Logic ---
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isProcessing) setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    if (!isProcessing && e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUploadClick = () => {
    if (!isProcessing) fileInputRef.current?.click();
  };

  const handleUploadKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleUploadClick();
    }
  };

  const handleFilenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (pages.length > 0 && !isMerging && !isProcessing) mergePdfs();
    }
  };

  const addFiles = async (files: File[]) => {
    if (isProcessing) return;
    setError("");
    setIsProcessing(true);

    const newUploadedFiles: UploadedFile[] = [];
    const newPages: PdfPage[] = [];

    // We need a temp copy of existing files to calculate colors correctly within this loop
    let currentUploadedFilesState = [...uploadedFiles];
    let addedPdf = false;
    let addedImage = false;

    for (const file of files) {
      if (
        file.type !== "application/pdf" &&
        file.type !== "image/jpeg" &&
        file.type !== "image/png"
      ) {
        setError(
          "Skipped unsupported file. Only PDF, PNG, and JPG are allowed.",
        );
        continue;
      }

      try {
        const fileId = `${Date.now()}-${Math.random()}`; // Unique ID for this specific upload

        // Get color based on what we have + what we've added in this batch so far
        const color = getAvailableColor([
          ...currentUploadedFilesState,
          ...newUploadedFiles,
        ]);

        if (file.type === "application/pdf") {
          addedPdf = true;
          const arrayBuffer = await file.arrayBuffer();
          const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer })
            .promise;
          const numPages = pdfDoc.numPages;

          const newFileObj = {
            id: fileId,
            fileName: file.name,
            color,
            pageCount: numPages,
            file,
            type: "pdf" as const,
          };
          newUploadedFiles.push(newFileObj);

          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 0.5 });
            const canvas = document.createElement("canvas");
            const context = canvas.getContext("2d")!;
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport }).promise;

            newPages.push({
              id: `${fileId}-${pageNum}`,
              sourceFileId: fileId, // Link to parent
              sourceFileName: file.name,
              sourceColor: color,
              pageNumber: pageNum,
              totalPages: numPages,
              type: "pdf",
              thumbnailDataUrl: canvas.toDataURL(),
              width: viewport.width,
              height: viewport.height,
            });
          }
        } else {
          addedImage = true;
          const objectUrl = URL.createObjectURL(file);
          const img = new Image();
          img.src = objectUrl;
          await new Promise((resolve) => {
            img.onload = resolve;
          });

          const newFileObj = {
            id: fileId,
            fileName: file.name,
            color,
            pageCount: 1,
            file,
            type: "image" as const,
          };
          newUploadedFiles.push(newFileObj);

          newPages.push({
            id: `${fileId}-img`,
            sourceFileId: fileId, // Link to parent
            sourceFileName: file.name,
            sourceColor: color,
            pageNumber: 1,
            totalPages: 1,
            type: "image",
            thumbnailDataUrl: objectUrl,
            width: img.width,
            height: img.height,
          });
        }
      } catch (err) {
        console.error("Error processing file:", err);
        setError(`Failed to process ${file.name}`);
      }
    }

    if (addedPdf && !addedImage && activeSettingsTab === "image")
      setActiveSettingsTab("pdf");
    if (addedImage && !addedPdf && activeSettingsTab === "pdf")
      setActiveSettingsTab("image");

    const updatedPages = [...pages, ...newPages];
    const updatedFiles = [...uploadedFiles, ...newUploadedFiles];

    setPages(updatedPages);
    setUploadedFiles(updatedFiles);
    updateFilename(updatedPages, updatedFiles);
    setIsProcessing(false);
  };

  const removePage = (pageId: string) => {
    if (isProcessing) return;

    // Find the page before removing to identify its source file
    const pageToRemove = pages.find((p) => p.id === pageId);
    if (!pageToRemove) return;

    // Remove the page
    const newPages = pages.filter((page) => page.id !== pageId);
    setPages(newPages);

    // Check if any pages from this source file remain
    const remainingPagesFromFile = newPages.filter(
      (p) => p.sourceFileId === pageToRemove.sourceFileId,
    );

    let newFiles = uploadedFiles;
    // If no pages remain, remove the file from Source Files list too
    if (remainingPagesFromFile.length === 0) {
      newFiles = uploadedFiles.filter(
        (f) => f.id !== pageToRemove.sourceFileId,
      );
      setUploadedFiles(newFiles);
    }

    updateFilename(newPages, newFiles);
  };

  const removeFile = (fileId: string) => {
    if (isProcessing) return;

    // Remove all pages associated with this specific File ID
    const newPages = pages.filter((p) => p.sourceFileId !== fileId);

    // Remove the file itself using ID (handles duplicates correctly)
    const newFiles = uploadedFiles.filter((f) => f.id !== fileId);

    setPages(newPages);
    setUploadedFiles(newFiles);
    updateFilename(newPages, newFiles);
  };

  const confirmClearAll = () => {
    if (isProcessing) return;
    setPages([]);
    setUploadedFiles([]);
    setOutputFileName("merged-document");
    setShowClearConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePageClick = (type: "image" | "pdf") => {
    setActiveSettingsTab(type);
  };

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

  const mergePdfs = async () => {
    if (pages.length === 0) return;
    setIsMerging(true);

    try {
      const mergedPdf = await PDFDocument.create();
      const sourcePdfCache = new Map<string, PDFDocument>();

      for (const page of pages) {
        // Find file by ID to handle duplicates correctly
        const sourceFileObj = uploadedFiles.find(
          (u) => u.id === page.sourceFileId,
        );
        if (!sourceFileObj) continue;

        if (page.type === "pdf") {
          // Key cache by ID so duplicates are treated as distinct sources (safer for pdf-lib)
          let sourcePdf = sourcePdfCache.get(page.sourceFileId);
          if (!sourcePdf) {
            const arrayBuffer = await sourceFileObj.file.arrayBuffer();
            sourcePdf = await PDFDocument.load(arrayBuffer);
            sourcePdfCache.set(page.sourceFileId, sourcePdf);
          }

          if (settings.pdf.pageSize === "Original") {
            const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [
              page.pageNumber - 1,
            ]);
            mergedPdf.addPage(copiedPage);
          } else {
            const [embeddedPage] = await mergedPdf.embedPdf(sourcePdf, [
              page.pageNumber - 1,
            ]);
            const targetSize =
              PAGE_SIZES[settings.pdf.pageSize as "A4" | "Letter"];
            const newPage = mergedPdf.addPage([targetSize[0], targetSize[1]]);
            const scaleX = targetSize[0] / embeddedPage.width;
            const scaleY = targetSize[1] / embeddedPage.height;
            const scaleFactor = Math.min(scaleX, scaleY);
            const drawWidth = embeddedPage.width * scaleFactor;
            const drawHeight = embeddedPage.height * scaleFactor;
            const x = (targetSize[0] - drawWidth) / 2;
            const y = (targetSize[1] - drawHeight) / 2;

            newPage.drawPage(embeddedPage, {
              x,
              y,
              width: drawWidth,
              height: drawHeight,
            });
          }
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

          if (settings.image.pageSize === "Fit") {
            pageWidth = imgDims.width;
            pageHeight = imgDims.height;
          } else {
            const rawSize =
              PAGE_SIZES[settings.image.pageSize as "A4" | "Letter"];
            if (settings.image.orientation === "landscape") {
              pageWidth = rawSize[1];
              pageHeight = rawSize[0];
            } else {
              pageWidth = rawSize[0];
              pageHeight = rawSize[1];
            }
          }

          const newPage = mergedPdf.addPage([pageWidth, pageHeight]);

          if (settings.image.pageSize === "Fit") {
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

  const baseWidth = 100;
  const canSwitchSettings = hasImages && hasPdfs;

  return (
    <div className="max-w-[90%] mx-auto mt-10 px-4 pb-20">
      <Link
        to="/pdf"
        className="text-sm text-blue-600 hover:underline mb-4 block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm w-fit"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="w-full">
        {/* Hidden Input */}
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          accept="application/pdf,image/png,image/jpeg"
          onChange={handleFileSelect}
          multiple
        />

        {error && (
          <p className="text-red-500 text-sm mb-4 font-medium text-center">
            {error}
          </p>
        )}

        {!hasFiles ? (
          // --- Empty State ---
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200">
            <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
              Merge PDFs & Images
            </h1>
            <p className="text-gray-500 mb-8 text-center">
              Upload PDFs or Images, reorder pages, and merge into one document.
            </p>

            <div className="relative">
              <div
                tabIndex={isProcessing ? -1 : 0}
                role="button"
                onKeyDown={handleUploadKeyDown}
                onClick={handleUploadClick}
                onDragOver={handleDragEnter}
                onDrop={handleDrop}
                className={`
                  relative border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-12 mb-6 hover:bg-gray-100 hover:border-blue-400
                  transition-all cursor-pointer outline-none group
                  focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                  ${isProcessing ? "opacity-50 pointer-events-none grayscale" : ""}
                `}
              >
                <div className="flex flex-col items-center">
                  <div className="mx-auto h-12 w-12 text-gray-400 mb-3 group-hover:text-blue-500 transition-colors">
                    <UploadCloud size={48} />
                  </div>
                  <span className="block text-sm font-medium text-gray-700">
                    Click to upload files
                  </span>
                  <span className="block text-xs text-gray-400 mt-1">
                    PDF, JPG, PNG supported
                  </span>
                </div>
              </div>

              {/* Empty State Loader Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 rounded-xl backdrop-blur-sm">
                  <Loader2
                    className="animate-spin text-blue-600 mb-3"
                    size={48}
                  />
                  <p className="text-sm font-medium text-blue-600">
                    Processing files...
                  </p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-8 items-start">
            {/* --- Left Column: Content (Scrolls & Drop Zone) --- */}
            <div
              className={`flex-1 w-full min-w-0 transition-colors rounded-xl relative ${isDraggingFile ? "ring-4 ring-blue-400 bg-blue-50" : ""}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {/* Drop Overlay Hint */}
              {isDraggingFile && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/80 rounded-xl backdrop-blur-sm pointer-events-none">
                  <div className="text-center text-blue-600">
                    <UploadCloud
                      size={64}
                      className="mx-auto mb-4 animate-bounce"
                    />
                    <h2 className="text-2xl font-bold">
                      Drop files here to add
                    </h2>
                  </div>
                </div>
              )}

              {/* Active State Loader Overlay */}
              {isProcessing && (
                <div className="absolute inset-0 z-50 flex justify-center bg-white/60 backdrop-blur-[2px] rounded-xl cursor-wait">
                  <div className="sticky top-1/2 h-fit -translate-y-1/2 flex flex-col items-center p-6 bg-white rounded-2xl shadow-xl border border-gray-100">
                    <Loader2
                      className="animate-spin text-blue-600 mb-3"
                      size={48}
                    />
                    <p className="text-base font-medium text-gray-700">
                      Processing new files...
                    </p>
                  </div>
                </div>
              )}

              {/* Sticky Glassy Header */}
              <div className="lg:sticky lg:top-24 z-30 mb-6">
                <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-b from-gray-50/0 to-gray-50/90 pointer-events-none" />

                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-md">
                  <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      Merge PDFs & Images
                      <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        {pages.length} Pages
                      </span>
                    </h1>
                    <p className="text-xs text-gray-500 mt-1">
                      Drag pages to reorder. Drop new files anywhere.
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <ZoomOut size={16} className="text-gray-500" />
                    <input
                      type="range"
                      min="1"
                      max="6"
                      step="0.5"
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <ZoomIn size={16} className="text-gray-500" />
                  </div>
                </div>
              </div>

              {/* Page Grid */}
              <div className="flex flex-wrap gap-4 p-6 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] content-start items-start justify-center lg:justify-start">
                {pages.map((page, index) => {
                  const displayWidth = baseWidth * scale;
                  const truncatedName = truncateFilename(page.sourceFileName);

                  return (
                    <div
                      key={page.id}
                      draggable={!isProcessing}
                      onClick={() => handlePageClick(page.type)}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`
                          relative group cursor-pointer flex flex-col bg-white rounded-sm shadow-md transition-all shrink-0
                          ${draggedIndex === index ? "opacity-50 scale-105 border-2 border-blue-400" : "border border-gray-200 hover:shadow-lg hover:ring-2 hover:ring-blue-200"}
                          ${activeSettingsTab === page.type ? "ring-2 ring-blue-100 border-blue-200" : ""}
                        `}
                      style={{ width: `${displayWidth}px` }}
                      title={`${page.sourceFileName} (${page.type.toUpperCase()}) - Page ${page.pageNumber}`}
                    >
                      <div
                        className="absolute -top-2 -left-2 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10 shadow-sm"
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

                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity z-20">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removePage(page.id);
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1 shadow-md"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      <div className="w-full h-full bg-gray-100 overflow-hidden rounded-sm relative">
                        <img
                          src={page.thumbnailDataUrl}
                          alt={`Page ${page.pageNumber}`}
                          className="w-full h-auto block"
                          draggable={false}
                        />
                      </div>

                      <div className="p-2 border-t border-gray-100 bg-white text-center">
                        <p className="text-[10px] text-gray-700 font-medium truncate">
                          {truncatedName}
                        </p>
                        {page.type === "pdf" && (
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            Page {page.pageNumber} / {page.totalPages}
                          </p>
                        )}
                        {page.type === "image" && (
                          <p className="text-[9px] text-gray-400 mt-0.5">
                            Image
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                <div
                  onClick={handleUploadClick}
                  className={`
                      flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white
                      hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-400 transition-all shrink-0 cursor-pointer
                    `}
                  style={{
                    width: `${baseWidth * scale}px`,
                    height: `${baseWidth * scale * 1.414}px`,
                  }}
                >
                  <Plus size={24 * (scale > 2 ? 1.5 : 1)} />
                  <span className="text-xs font-medium mt-2">Add Files</span>
                </div>
              </div>
            </div>

            {/* --- Right Column: Sticky Actions --- */}
            <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24 space-y-4 h-fit">
              {/* 1. Source Files List */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                    <FileIcon size={14} className="text-gray-500" />
                    Source Files
                  </h3>
                  <button
                    onClick={handleUploadClick}
                    disabled={isProcessing}
                    className={`text-xs flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    <Plus size={12} /> Add
                  </button>
                </div>

                <div className="max-h-[220px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {uploadedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 group"
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: file.color }}
                        ></div>
                        <div className="min-w-0">
                          <p
                            className="text-xs font-medium text-gray-700 truncate"
                            title={file.fileName}
                          >
                            {truncateFilename(file.fileName, 18)}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {file.type === "pdf"
                              ? `${file.pageCount} pages`
                              : "Image"}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(file.id)}
                        disabled={isProcessing}
                        className={`text-gray-300 hover:text-red-500 transition-colors p-1 ${isProcessing ? "cursor-not-allowed opacity-50" : ""}`}
                        title="Remove file"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* 2. Clear All */}
              {!showClearConfirm ? (
                <button
                  onClick={() => !isProcessing && setShowClearConfirm(true)}
                  disabled={isProcessing}
                  className={`w-full py-2 rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 hover:border-red-300 font-medium text-sm flex items-center justify-center gap-2 transition-colors ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <Trash2 size={16} /> Clear All Pages
                </button>
              ) : (
                <div className="flex items-center gap-2 bg-red-50 p-2 rounded-lg border border-red-200 animate-fade-in">
                  <span className="text-xs text-red-800 font-medium flex-1 pl-2">
                    Confirm clear?
                  </span>
                  <button
                    onClick={confirmClearAll}
                    className="text-xs bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700 font-medium"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="text-xs bg-white text-gray-700 border border-gray-300 px-3 py-1.5 rounded hover:bg-gray-50 font-medium"
                  >
                    No
                  </button>
                </div>
              )}

              {/* 3. Merge Actions Card */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <CheckCircle size={16} className="text-blue-600" />
                  Merge & Download
                </h3>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">
                    Filename
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FileEdit size={14} className="text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={outputFileName}
                      onChange={(e) => setOutputFileName(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      onKeyDown={handleFilenameKeyDown}
                      className="w-full pl-8 pr-8 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <span className="text-gray-400 font-medium text-xs">
                        .pdf
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={mergePdfs}
                  disabled={isMerging || isProcessing}
                  className={`
                      w-full font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm
                      ${isMerging || isProcessing ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"}
                    `}
                >
                  {isMerging ? "Merging..." : "Download PDF"}
                </button>
              </div>

              {/* 4. Settings Card */}
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                    <Settings size={16} className="text-gray-600" />
                    Configuration
                  </h3>

                  {canSwitchSettings && (
                    <div className="relative" ref={settingsRef}>
                      <button
                        onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                      >
                        Switch
                        <ChevronDown size={12} />
                      </button>
                      {isSettingsOpen && (
                        <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded shadow-lg z-50">
                          <button
                            onClick={() => {
                              setActiveSettingsTab(
                                activeSettingsTab === "image" ? "pdf" : "image",
                              );
                              setIsSettingsOpen(false);
                            }}
                            className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
                          >
                            {activeSettingsTab === "image"
                              ? "PDF Settings"
                              : "Image Settings"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="text-xs font-medium text-gray-500 mb-2">
                  Configuring:{" "}
                  <span className="text-gray-800">
                    {activeSettingsTab === "image"
                      ? "Image Files"
                      : "PDF Files"}
                  </span>
                </div>

                {activeSettingsTab === "image" ? (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        PAGE SIZE
                      </label>
                      <div className="space-y-1">
                        {["A4", "Letter", "Fit"].map((size) => (
                          <label
                            key={size}
                            className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="radio"
                              name="imgPageSize"
                              checked={settings.image.pageSize === size}
                              onChange={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  image: {
                                    ...prev.image,
                                    pageSize: size as any,
                                  },
                                }))
                              }
                              className="w-3.5 h-3.5 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">
                              {size}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {settings.image.pageSize !== "Fit" && (
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-2">
                          ORIENTATION
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                image: {
                                  ...prev.image,
                                  orientation: "portrait",
                                },
                              }))
                            }
                            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded border transition-all ${
                              settings.image.orientation === "portrait"
                                ? "bg-blue-50 text-blue-700 border-blue-200 font-medium"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <RectangleVertical size={12} /> Portrait
                          </button>
                          <button
                            onClick={() =>
                              setSettings((prev) => ({
                                ...prev,
                                image: {
                                  ...prev.image,
                                  orientation: "landscape",
                                },
                              }))
                            }
                            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded border transition-all ${
                              settings.image.orientation === "landscape"
                                ? "bg-blue-50 text-blue-700 border-blue-200 font-medium"
                                : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                            }`}
                          >
                            <RectangleHorizontal size={12} /> Landscape
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    <div>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        TARGET SIZE
                      </label>
                      <div className="space-y-1">
                        {["Original", "A4", "Letter"].map((size) => (
                          <label
                            key={size}
                            className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-gray-50 transition-colors"
                          >
                            <input
                              type="radio"
                              name="pdfPageSize"
                              checked={settings.pdf.pageSize === size}
                              onChange={() =>
                                setSettings((prev) => ({
                                  ...prev,
                                  pdf: { pageSize: size as any },
                                }))
                              }
                              className="w-3.5 h-3.5 text-blue-600"
                            />
                            <span className="text-sm text-gray-700">
                              {size}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
