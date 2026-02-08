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
  totalPages: number;
  type: "pdf" | "image";
  thumbnailDataUrl: string;
  width?: number;
  height?: number;
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
const truncateFilename = (name: string, maxLength: number = 15) => {
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

  // --- Helper: Generate Filename ---
  const updateFilename = (
    currentPages: PdfPage[],
    allUploadedFiles: UploadedFile[],
  ) => {
    const activeFileNames = new Set(currentPages.map((p) => p.sourceFileName));
    const activeFiles = allUploadedFiles.filter((f) =>
      activeFileNames.has(f.fileName),
    );
    const timestamp = new Date()
      .toISOString()
      .replace(/[-:T.]/g, "")
      .slice(0, 14);
    let newName = `merged-doc-${timestamp}`;

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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files));
  };

  const handleUploadClick = () => fileInputRef.current?.click();

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
    setError("");
    setIsProcessing(true);

    const newUploadedFiles: UploadedFile[] = [];
    const newPages: PdfPage[] = [];
    let count = uploadedFiles.length;
    let addedPdf = false;
    let addedImage = false;

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
          addedPdf = true;
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
            const viewport = page.getViewport({ scale: 0.5 });
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

    // Auto-switch tab if we added a specific type and it was previously the other way
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

  const removePage = (id: string) => {
    const newPages = pages.filter((page) => page.id !== id);
    setPages(newPages);
    updateFilename(newPages, uploadedFiles);
  };

  const confirmClearAll = () => {
    setPages([]);
    setUploadedFiles([]);
    setOutputFileName("merged-document");
    setShowClearConfirm(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Click Selection Logic ---
  const handlePageClick = (type: "image" | "pdf") => {
    // Just switch the tab, don't open the dropdown
    setActiveSettingsTab(type);
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
  // Calculate if we should enable the dropdown toggle
  const canSwitchSettings = hasImages && hasPdfs;

  return (
    <div className="max-w-7xl mx-auto mt-10 px-4 pb-20">
      <Link
        to="/pdf"
        className="text-sm text-blue-600 hover:underline mb-4 block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="w-full bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-200">
        {/* --- Header / Upload Toggle --- */}
        {!hasFiles ? (
          // State 1: Empty - Large Centered Header & Upload
          <>
            <h1 className="text-2xl font-bold text-gray-800 mb-2 text-center">
              Merge PDFs & Images
            </h1>
            <p className="text-gray-500 mb-8 text-center">
              Upload PDFs or Images, reorder pages, and merge into one document.
            </p>

            <div
              tabIndex={0}
              role="button"
              onKeyDown={handleUploadKeyDown}
              onClick={handleUploadClick}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`
                relative border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-12 mb-6 hover:bg-gray-100 hover:border-blue-400
                transition-all cursor-pointer outline-none group
                focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                ${error ? "border-red-300 bg-red-50" : ""}
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
          </>
        ) : (
          // State 2: Active - Split Layout (Left: Info, Right: Dropzone)
          <div className="flex flex-col md:flex-row gap-6 mb-6 border-b border-gray-100 pb-6 min-h-[120px]">
            {/* Left: Info */}
            <div className="md:w-1/2 flex flex-col justify-center">
              <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                Merge PDFs & Images
                <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                  {pages.length} Pages
                </span>
              </h1>
              <p className="text-sm text-gray-500 mt-2">
                Drag pages to reorder. Click a page to configure specific
                settings below.
              </p>
            </div>

            {/* Right: Upload Dropzone */}
            <div
              tabIndex={0}
              role="button"
              onKeyDown={handleUploadKeyDown}
              onClick={handleUploadClick}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`
                md:w-1/2 border-2 border-dashed border-blue-200 bg-blue-50/50 rounded-xl
                flex flex-col items-center justify-center p-4 cursor-pointer transition-all
                hover:bg-blue-50 hover:border-blue-400 outline-none focus:ring-2 focus:ring-blue-500
              `}
            >
              <div className="flex items-center gap-3 text-blue-700">
                <UploadCloud size={24} />
                <span className="font-medium text-base">Add more files</span>
              </div>
              <span className="text-xs text-blue-400 mt-1">
                or drag and drop here
              </span>
            </div>
          </div>
        )}

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
        {isProcessing && (
          <div className="text-center mb-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600 mt-2">Processing files...</p>
          </div>
        )}

        {/* --- Controls Bar --- */}
        {hasFiles && (
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 mb-6 flex flex-col xl:flex-row items-center gap-4 xl:gap-6 justify-between sticky top-4 z-30 shadow-sm">
            {/* Left: Zoom */}
            <div className="flex items-center gap-3 w-full xl:w-auto justify-center xl:justify-start">
              <ZoomOut size={16} className="text-gray-500" />
              <input
                type="range"
                min="1"
                max="6"
                step="0.5"
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-32 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <ZoomIn size={16} className="text-gray-500" />
            </div>

            {/* Center: Settings Panel */}
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 bg-white rounded-md border border-gray-200 shadow-sm w-full xl:w-auto transition-all duration-300">
              {/* Dropdown for Context Switching */}
              <div className="relative mr-2 border-r pr-4" ref={settingsRef}>
                <button
                  onClick={() =>
                    canSwitchSettings && setIsSettingsOpen(!isSettingsOpen)
                  }
                  disabled={!canSwitchSettings}
                  className={`
                    flex items-center gap-2 text-sm font-medium px-2 py-1 rounded transition-colors focus:outline-none
                    ${canSwitchSettings ? "hover:bg-gray-100 cursor-pointer text-gray-700" : "cursor-default text-gray-800"}
                  `}
                >
                  <Settings size={14} className="text-gray-500" />
                  {activeSettingsTab === "image"
                    ? "Image Settings"
                    : "PDF Settings"}

                  {/* Only show arrow if we have both types to switch between */}
                  {canSwitchSettings &&
                    (isSettingsOpen ? (
                      <ChevronDown
                        size={12}
                        className="rotate-180 transition-transform"
                      />
                    ) : (
                      <ChevronDown size={12} className="transition-transform" />
                    ))}
                </button>

                {/* Click-Triggered Dropdown - ONLY shows the OTHER option */}
                {isSettingsOpen && canSwitchSettings && (
                  <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50 animate-fade-in overflow-hidden">
                    {activeSettingsTab === "image" ? (
                      <button
                        onClick={() => {
                          setActiveSettingsTab("pdf");
                          setIsSettingsOpen(false);
                        }}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-blue-50 text-gray-700 transition-colors"
                      >
                        Switch to PDF Settings
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setActiveSettingsTab("image");
                          setIsSettingsOpen(false);
                        }}
                        className="block w-full text-left px-4 py-3 text-sm hover:bg-blue-50 text-gray-700 transition-colors"
                      >
                        Switch to Image Settings
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Dynamic Options based on Tab */}
              {activeSettingsTab === "image" ? (
                // --- Image Options ---
                <>
                  <div className="flex items-center gap-3">
                    {["A4", "Letter", "Fit"].map((size) => (
                      <label
                        key={size}
                        className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700 hover:text-blue-600"
                      >
                        <input
                          type="radio"
                          name="imgPageSize"
                          checked={settings.image.pageSize === size}
                          onChange={() =>
                            setSettings((prev) => ({
                              ...prev,
                              image: { ...prev.image, pageSize: size as any },
                            }))
                          }
                          className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                        />
                        {size}
                      </label>
                    ))}
                  </div>

                  {settings.image.pageSize !== "Fit" && (
                    <div className="flex items-center gap-1 ml-2 border-l pl-4">
                      <button
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            image: { ...prev.image, orientation: "portrait" },
                          }))
                        }
                        title="Portrait"
                        className={`p-1.5 rounded transition-colors ${settings.image.orientation === "portrait" ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}
                      >
                        <RectangleVertical size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            image: { ...prev.image, orientation: "landscape" },
                          }))
                        }
                        title="Landscape"
                        className={`p-1.5 rounded transition-colors ${settings.image.orientation === "landscape" ? "bg-blue-100 text-blue-700" : "text-gray-400 hover:text-gray-600"}`}
                      >
                        <RectangleHorizontal size={16} />
                      </button>
                    </div>
                  )}
                </>
              ) : (
                // --- PDF Options ---
                <div className="flex items-center gap-3">
                  {["Original", "A4", "Letter"].map((size) => (
                    <label
                      key={size}
                      className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-700 hover:text-blue-600"
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
                        className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
                      />
                      {size}
                    </label>
                  ))}
                  <span className="text-xs text-gray-400 ml-2 border-l pl-2 italic">
                    (Orientation auto)
                  </span>
                </div>
              )}
            </div>

            {/* Right: Clear All */}
            <div className="flex items-center w-full xl:w-auto justify-center xl:justify-end">
              {!showClearConfirm ? (
                <button
                  onClick={() => setShowClearConfirm(true)}
                  className="flex items-center gap-2 text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <Trash2 size={16} />
                  Clear All
                </button>
              ) : (
                <div className="flex items-center gap-2 animate-fade-in bg-red-50 px-2 py-1 rounded border border-red-100">
                  <span className="text-xs text-red-800 font-medium">
                    Confirm?
                  </span>
                  <button
                    onClick={confirmClearAll}
                    className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700"
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="text-xs bg-white text-gray-600 border border-gray-300 px-2 py-1 rounded hover:bg-gray-50"
                  >
                    No
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- Pages Grid --- */}
        {hasFiles && (
          <div className="flex flex-wrap gap-6 mb-6 p-6 bg-gray-50 rounded-lg min-h-[200px] content-start items-start justify-center">
            {pages.map((page, index) => {
              const displayWidth = baseWidth * scale;
              const truncatedName = truncateFilename(page.sourceFileName);

              return (
                <div
                  key={page.id}
                  draggable
                  onClick={() => handlePageClick(page.type)}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`
                    relative group cursor-pointer flex flex-col bg-white rounded-sm shadow-md transition-all shrink-0
                    ${draggedIndex === index ? "opacity-50 scale-105 border-2 border-blue-400" : "border border-gray-200 hover:shadow-lg hover:ring-2 hover:ring-blue-200"}
                  `}
                  style={{ width: `${displayWidth}px` }}
                  title={`${page.sourceFileName} (${page.type.toUpperCase()}) - Page ${page.pageNumber}`}
                >
                  {/* Badge */}
                  <div
                    className="absolute -top-2 -left-2 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10 shadow-sm"
                    style={{ backgroundColor: page.sourceColor }}
                  >
                    {index + 1}
                  </div>

                  {/* Type Icon */}
                  <div className="absolute top-2 right-2 z-10 bg-white/90 p-1 rounded-md shadow-sm">
                    {page.type === "image" ? (
                      <ImageIcon size={12} className="text-purple-600" />
                    ) : (
                      <FileText size={12} className="text-blue-600" />
                    )}
                  </div>

                  {/* Remove Btn */}
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

                  {/* Preview Container */}
                  <div className="w-full h-full bg-gray-100 overflow-hidden rounded-sm relative">
                    <img
                      src={page.thumbnailDataUrl}
                      alt={`Page ${page.pageNumber}`}
                      className="w-full h-auto block"
                      draggable={false}
                    />
                  </div>

                  {/* Footer Info */}
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
                      <p className="text-[9px] text-gray-400 mt-0.5">Image</p>
                    )}
                  </div>
                </div>
              );
            })}

            {/* --- Add Page Card (Grid) --- */}
            {/* Added back to the grid flow as requested */}
            <div
              onClick={handleUploadClick}
              className={`
                flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50
                hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-400 transition-all shrink-0 cursor-pointer
              `}
              style={{
                width: `${baseWidth * scale}px`,
                // Force an A4 aspect ratio height (1.414) so it aligns with standard document pages
                height: `${baseWidth * scale * 1.414}px`,
              }}
            >
              <Plus size={24 * (scale > 2 ? 1.5 : 1)} />
              <span className="text-xs font-medium mt-2">Add Files</span>
            </div>
          </div>
        )}

        {/* --- Action Bar --- */}
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
              disabled={!hasFiles || isMerging || isProcessing}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-400 font-medium text-sm">.pdf</span>
            </div>
          </div>
          <button
            onClick={mergePdfs}
            disabled={!hasFiles || isMerging || isProcessing}
            className={`
              md:w-auto font-semibold py-3 px-8 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
              ${!hasFiles || isMerging || isProcessing ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95"}
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
    </div>
  );
}
