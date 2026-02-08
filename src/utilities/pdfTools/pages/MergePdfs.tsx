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
  RotateCcw,
  ListRestart,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDocument } from "pdf-lib";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- Types ---

interface PdfPage {
  id: string;
  sourceFileId: string;
  sourceFileName: string;
  sourceColor: string;
  pageNumber: number; // 1-based
  totalPages: number;
  type: "pdf" | "image";
  thumbnailDataUrl?: string;
  width: number;
  height: number;
}

interface UploadedFile {
  id: string;
  fileName: string;
  color: string;
  pageCount: number;
  file: File;
  type: "pdf" | "image";
}

// --- Constants ---

const COLOR_POOL = [
  "#3B82F6",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#6366F1",
  "#84CC16",
  "#06B6D4",
  "#D946EF",
];

const PAGE_SIZES = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
  Fit: [0, 0],
  Original: [0, 0],
};

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

// --- Component: Dynamic PDF Page Renderer ---
const PdfPageThumbnail = ({
  file,
  pageNumber,
  width,
}: {
  file: File;
  pageNumber: number;
  width: number;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const renderPage = async () => {
      if (!canvasRef.current || !file) return;

      try {
        setLoading(true);
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);

        if (!isMounted) return;

        const originalViewport = page.getViewport({ scale: 0.5 });
        const scaleRequired = (width / originalViewport.width) * 1.5;
        const viewport = page.getViewport({
          scale: Math.max(scaleRequired, 1),
        });

        const canvas = canvasRef.current;
        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (renderTaskRef.current) renderTaskRef.current.cancel();

        const renderTask = page.render({
          canvasContext: context,
          viewport,
          canvas,
        });
        renderTaskRef.current = renderTask;

        await renderTask.promise;
        setLoading(false);
      } catch (err: any) {
        if (err.name !== "RenderingCancelledException")
          console.error("Page render error:", err);
      }
    };

    const timer = setTimeout(() => renderPage(), 100);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [file, pageNumber, width]);

  return (
    <div className="w-full h-full relative bg-white">
      <canvas ref={canvasRef} className="w-full h-full object-contain block" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
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

  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const [draggedFileIndex, setDraggedFileIndex] = useState<number | null>(null);

  const [settings, setSettings] = useState<MergeSettings>(DEFAULT_SETTINGS);
  const [activeSettingsTab, setActiveSettingsTab] = useState<"image" | "pdf">(
    "image",
  );

  const fileInputRef = useRef<HTMLInputElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

  const hasImages = uploadedFiles.some((f) => f.type === "image");
  const hasPdfs = uploadedFiles.some((f) => f.type === "pdf");
  const hasFiles = pages.length > 0;

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

  useEffect(() => {
    if (hasPdfs && !hasImages && activeSettingsTab === "image")
      setActiveSettingsTab("pdf");
    else if (hasImages && !hasPdfs && activeSettingsTab === "pdf")
      setActiveSettingsTab("image");
  }, [hasImages, hasPdfs, activeSettingsTab]);

  const getAvailableColor = (currentFiles: UploadedFile[]) => {
    const usedColors = new Set(currentFiles.map((f) => f.color));
    const available = COLOR_POOL.find((c) => !usedColors.has(c));
    return available || COLOR_POOL[currentFiles.length % COLOR_POOL.length];
  };

  const updateFilename = (
    currentPages: PdfPage[],
    allUploadedFiles: UploadedFile[],
  ) => {
    const activeFileIds = new Set(currentPages.map((p) => p.sourceFileId));
    const activeFiles = allUploadedFiles.filter((f) => activeFileIds.has(f.id));
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

  const getPageDimensions = (page: PdfPage) => {
    let targetW, targetH;
    if (page.type === "image") {
      const { pageSize, orientation } = settings.image;
      if (pageSize === "Fit") {
        targetW = page.width;
        targetH = page.height;
      } else {
        const dims = PAGE_SIZES[pageSize as "A4" | "Letter"];
        if (orientation === "landscape") {
          targetW = dims[1];
          targetH = dims[0];
        } else {
          targetW = dims[0];
          targetH = dims[1];
        }
      }
    } else {
      const { pageSize } = settings.pdf;
      if (pageSize === "Original") {
        targetW = page.width;
        targetH = page.height;
      } else {
        const dims = PAGE_SIZES[pageSize as "A4" | "Letter"];
        targetW = dims[0];
        targetH = dims[1];
      }
    }
    return { width: targetW, height: targetH };
  };

  const syncFileListToPages = (
    currentPages: PdfPage[],
    currentFiles: UploadedFile[],
  ) => {
    const filePositions = new Map<string, { sum: number; count: number }>();
    currentPages.forEach((page, index) => {
      const entry = filePositions.get(page.sourceFileId) || {
        sum: 0,
        count: 0,
      };
      entry.sum += index;
      entry.count += 1;
      filePositions.set(page.sourceFileId, entry);
    });

    const sortedFiles = [...currentFiles].sort((a, b) => {
      const posA = filePositions.get(a.id);
      const posB = filePositions.get(b.id);
      if (!posA) return 1;
      if (!posB) return -1;
      return posA.sum / posA.count - posB.sum / posB.count;
    });

    setUploadedFiles(sortedFiles);
  };

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files));
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggedIndex !== null || draggedFileIndex !== null) return;
    if (!isProcessing && e.dataTransfer.types.includes("Files"))
      setIsDraggingFile(true);
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
    if (
      draggedIndex === null &&
      draggedFileIndex === null &&
      !isProcessing &&
      e.dataTransfer.files?.length > 0
    ) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleUploadClick = () =>
    !isProcessing && fileInputRef.current?.click();

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
  const handleDragEnd = () => {
    setDraggedIndex(null);
    syncFileListToPages(pages, uploadedFiles);
  };

  const handleFileDragStart = (e: React.DragEvent, index: number) => {
    if ((e.target as HTMLElement).closest("button")) {
      e.preventDefault();
      return;
    }
    setDraggedFileIndex(index);
  };

  const handleFileDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFileIndex === null || draggedFileIndex === index) return;
    const newFiles = [...uploadedFiles];
    const draggedItem = newFiles[draggedFileIndex];
    newFiles.splice(draggedFileIndex, 1);
    newFiles.splice(index, 0, draggedItem);
    setUploadedFiles(newFiles);
    setDraggedFileIndex(index);
  };

  const handleFileDragEnd = () => {
    setDraggedFileIndex(null);
    if (draggedFileIndex === null) return;

    const movedFile = uploadedFiles[draggedFileIndex];
    if (!movedFile) return;

    const movedPages = pages.filter((p) => p.sourceFileId === movedFile.id);
    const otherPages = pages.filter((p) => p.sourceFileId !== movedFile.id);

    if (movedPages.length === 0) return;

    const currentFileIndex = uploadedFiles.findIndex(
      (f) => f.id === movedFile.id,
    );
    let insertIndex = 0;

    if (currentFileIndex > 0) {
      for (let i = currentFileIndex - 1; i >= 0; i--) {
        const prevFileId = uploadedFiles[i].id;
        let lastPageIdx = -1;
        for (let p = otherPages.length - 1; p >= 0; p--) {
          if (otherPages[p].sourceFileId === prevFileId) {
            lastPageIdx = p;
            break;
          }
        }
        if (lastPageIdx !== -1) {
          insertIndex = lastPageIdx + 1;
          break;
        }
      }
    }

    const newPages = [
      ...otherPages.slice(0, insertIndex),
      ...movedPages,
      ...otherPages.slice(insertIndex),
    ];
    setPages(newPages);
  };

  const resetFileLayout = (fileId: string) => {
    const filePages = pages.filter((p) => p.sourceFileId === fileId);
    const otherPages = pages.filter((p) => p.sourceFileId !== fileId);
    if (filePages.length === 0) return;

    const sortedFilePages = [...filePages].sort(
      (a, b) => a.pageNumber - b.pageNumber,
    );
    const firstIndex = pages.findIndex((p) => p.sourceFileId === fileId);

    let otherCountBefore = 0;
    for (let i = 0; i < firstIndex; i++) {
      if (pages[i].sourceFileId !== fileId) otherCountBefore++;
    }

    const newPages = [
      ...otherPages.slice(0, otherCountBefore),
      ...sortedFilePages,
      ...otherPages.slice(otherCountBefore),
    ];
    setPages(newPages);
  };

  const resetAllLayout = () => {
    const pagesByFile = new Map<string, PdfPage[]>();
    pages.forEach((p) => {
      const group = pagesByFile.get(p.sourceFileId) || [];
      group.push(p);
      pagesByFile.set(p.sourceFileId, group);
    });

    const newPages: PdfPage[] = [];
    uploadedFiles.forEach((file) => {
      const group = pagesByFile.get(file.id);
      if (group) {
        group.sort((a, b) => a.pageNumber - b.pageNumber);
        newPages.push(...group);
      }
    });
    setPages(newPages);
  };

  const addFiles = async (files: File[]) => {
    if (isProcessing) return;
    setError("");
    setIsProcessing(true);

    const newUploadedFiles: UploadedFile[] = [];
    const currentUploadedFilesState = [...uploadedFiles];
    let addedPdf = false;
    let addedImage = false;

    for (const file of files) {
      if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
        setError("Skipped unsupported file.");
        continue;
      }

      try {
        const fileId = `${Date.now()}-${Math.random()}`;
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

          newUploadedFiles.push({
            id: fileId,
            fileName: file.name,
            color,
            pageCount: numPages,
            file,
            type: "pdf",
          });

          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const page = await pdfDoc.getPage(pageNum);
            const viewport = page.getViewport({ scale: 1 });

            setPages((prev) => [
              ...prev,
              {
                id: `${fileId}-${pageNum}`,
                sourceFileId: fileId,
                sourceFileName: file.name,
                sourceColor: color,
                pageNumber: pageNum,
                totalPages: numPages,
                type: "pdf",
                width: viewport.width,
                height: viewport.height,
              },
            ]);
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
            id: fileId,
            fileName: file.name,
            color,
            pageCount: 1,
            file,
            type: "image",
          });

          setPages((prev) => [
            ...prev,
            {
              id: `${fileId}-img`,
              sourceFileId: fileId,
              sourceFileName: file.name,
              sourceColor: color,
              pageNumber: 1,
              totalPages: 1,
              type: "image",
              thumbnailDataUrl: objectUrl,
              width: img.width,
              height: img.height,
            },
          ]);
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

    const updatedFiles = [...uploadedFiles, ...newUploadedFiles];
    setUploadedFiles(updatedFiles);

    setTimeout(() => {
      setPages((currentPages) => {
        updateFilename(currentPages, updatedFiles);
        return currentPages;
      });
      setIsProcessing(false);
    }, 0);
  };

  const removePage = (pageId: string) => {
    if (isProcessing) return;
    const pageToRemove = pages.find((p) => p.id === pageId);
    if (!pageToRemove) return;
    const newPages = pages.filter((page) => page.id !== pageId);
    setPages(newPages);

    const remainingPagesFromFile = newPages.filter(
      (p) => p.sourceFileId === pageToRemove.sourceFileId,
    );
    let newFiles = uploadedFiles;
    if (remainingPagesFromFile.length === 0) {
      newFiles = uploadedFiles.filter(
        (f) => f.id !== pageToRemove.sourceFileId,
      );
      setUploadedFiles(newFiles);
    } else {
      syncFileListToPages(newPages, uploadedFiles);
    }
    updateFilename(newPages, newFiles);
  };

  const removeFile = (fileId: string) => {
    if (isProcessing) return;
    const newPages = pages.filter((p) => p.sourceFileId !== fileId);
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

  const mergePdfs = async () => {
    if (pages.length === 0) return;
    setIsMerging(true);
    try {
      const mergedPdf = await PDFDocument.create();
      const sourcePdfCache = new Map<string, PDFDocument>();

      for (const page of pages) {
        const sourceFileObj = uploadedFiles.find(
          (u) => u.id === page.sourceFileId,
        );
        if (!sourceFileObj) continue;

        if (page.type === "pdf") {
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
          if (sourceFileObj.file.type === "image/png")
            embeddedImage = await mergedPdf.embedPng(arrayBuffer);
          else embeddedImage = await mergedPdf.embedJpg(arrayBuffer);

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
      const blob = new Blob([pdfBytes as any], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      let fileName = outputFileName.trim() || `merged-doc-${Date.now()}`;
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
    <div className="w-full max-w-none mx-auto mt-10 px-8 pb-20">
      <Link
        to="/pdf"
        className="text-sm text-blue-600 hover:underline mb-4 block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-sm w-fit"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="w-full">
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
                className={`relative border-2 border-dashed border-gray-300 bg-gray-50 rounded-xl p-12 mb-6 hover:bg-gray-100 hover:border-blue-400 transition-all cursor-pointer outline-none group focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${isProcessing ? "opacity-50 pointer-events-none grayscale" : ""}`}
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
            <div
              className={`flex-1 w-full min-w-0 transition-colors rounded-xl relative ${isDraggingFile ? "ring-4 ring-blue-400 bg-blue-50" : ""}`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
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
              <div className="lg:sticky lg:top-24 z-30 mb-6">
                <div className="absolute -top-12 left-0 right-0 h-12 bg-gradient-to-b from-gray-50/0 to-gray-50/90 pointer-events-none" />
                <div className="flex flex-col sm:flex-row justify-between items-end sm:items-center gap-4 bg-white/90 backdrop-blur-md p-4 rounded-xl border border-white/50 shadow-md">
                  <div>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                      Merge PDFs & Images{" "}
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

              <div
                className="grid gap-4 p-6 bg-white rounded-xl border border-gray-200 shadow-sm min-h-[400px] content-start"
                style={{
                  gridTemplateColumns: `repeat(auto-fill, minmax(${baseWidth * scale}px, 1fr))`,
                }}
              >
                {pages.map((page, index) => {
                  const truncatedName = truncateFilename(page.sourceFileName);
                  const { width: targetW, height: targetH } =
                    getPageDimensions(page);
                  const aspectRatioStyle = {
                    aspectRatio: `${targetW}/${targetH}`,
                  };

                  return (
                    <div
                      key={page.id}
                      draggable={!isProcessing}
                      onClick={() => setActiveSettingsTab(page.type)}
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDragEnd={handleDragEnd}
                      className={`relative group cursor-grab active:cursor-grabbing flex flex-col bg-white rounded-sm shadow-md transition-all shrink-0 ${draggedIndex === index ? "opacity-50 scale-105 border-2 border-blue-400" : "border border-gray-200 hover:shadow-lg hover:ring-2 hover:ring-blue-200"} ${activeSettingsTab === page.type ? "ring-2 ring-blue-100 border-blue-200" : ""}`}
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
                      <div
                        className="bg-gray-100 overflow-hidden rounded-sm relative flex items-center justify-center w-full"
                        style={aspectRatioStyle}
                      >
                        {page.type === "pdf" ? (
                          <PdfPageThumbnail
                            file={
                              uploadedFiles.find(
                                (f) => f.id === page.sourceFileId,
                              )?.file!
                            }
                            pageNumber={page.pageNumber}
                            width={baseWidth * scale}
                          />
                        ) : (
                          <img
                            src={page.thumbnailDataUrl}
                            alt={`Page ${page.pageNumber}`}
                            className="w-full h-full object-contain block"
                            draggable={false}
                          />
                        )}
                      </div>
                      <div className="p-2 border-t border-gray-100 bg-white text-center">
                        <p className="text-[10px] text-gray-700 font-medium truncate">
                          {truncatedName}
                        </p>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {page.type === "pdf"
                            ? `Page ${page.pageNumber} / ${page.totalPages}`
                            : "Image"}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div
                  onClick={handleUploadClick}
                  className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 text-gray-400 transition-all shrink-0 cursor-pointer`}
                  style={{ aspectRatio: "210/297" }}
                >
                  <Plus size={24 * (scale > 2 ? 1.5 : 1)} />
                  <span className="text-xs font-medium mt-2">Add Files</span>
                </div>
              </div>
            </div>

            <div className="w-full lg:w-80 shrink-0 lg:sticky lg:top-24 space-y-4 h-fit">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-700 text-sm flex items-center gap-2">
                    <FileIcon size={14} className="text-gray-500" /> Source
                    Files
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={resetAllLayout}
                      disabled={isProcessing}
                      className="text-gray-400 hover:text-blue-600 hover:bg-blue-50 p-1.5 rounded transition-colors"
                      title="Reset All Pages to File Order"
                    >
                      <ListRestart size={16} />
                    </button>
                    <button
                      onClick={handleUploadClick}
                      disabled={isProcessing}
                      className={`text-xs flex items-center gap-1 bg-white border border-gray-200 px-2 py-1 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-all ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>
                <div className="max-h-[220px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={file.id}
                      draggable
                      onDragStart={(e) => handleFileDragStart(e, index)}
                      onDragOver={(e) => handleFileDragOver(e, index)}
                      onDragEnd={handleFileDragEnd}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-100 hover:border-gray-200 group cursor-grab active:cursor-grabbing hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-2 overflow-hidden pointer-events-none">
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
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            resetFileLayout(file.id);
                          }}
                          disabled={isProcessing}
                          className="text-gray-300 hover:text-blue-500 transition-colors p-1"
                          title="Reset/Group Pages"
                        >
                          <RotateCcw size={14} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(file.id);
                          }}
                          disabled={isProcessing}
                          className={`text-gray-300 hover:text-red-500 transition-colors p-1 ${isProcessing ? "cursor-not-allowed opacity-50" : ""}`}
                          title="Remove file"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

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

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                  <CheckCircle size={16} className="text-blue-600" /> Merge &
                  Download
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
                  className={`w-full font-semibold py-2.5 px-4 rounded-lg shadow-sm transition-all flex items-center justify-center gap-2 text-sm ${isMerging || isProcessing ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"}`}
                >
                  {isMerging ? "Merging..." : "Download PDF"}
                </button>
              </div>

              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-gray-100 pb-2">
                  <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                    <Settings size={16} className="text-gray-600" />{" "}
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
                            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded border transition-all ${settings.image.orientation === "portrait" ? "bg-blue-50 text-blue-700 border-blue-200 font-medium" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
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
                            className={`flex items-center justify-center gap-1 py-1.5 text-xs rounded border transition-all ${settings.image.orientation === "landscape" ? "bg-blue-50 text-blue-700 border-blue-200 font-medium" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"}`}
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
