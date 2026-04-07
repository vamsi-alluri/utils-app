import { useState, useRef, useEffect } from "react";
import {
  UploadCloud,
  Scissors,
  Check,
  ZoomIn,
  ZoomOut,
  FileDown,
  Loader2,
  AlertCircle,
  X,
  FileText,
} from "lucide-react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.mjs?url";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

// --- Utilities ---

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

// --- Component: PDF Page Thumbnail Renderer ---

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
          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

export default function SplitPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [baseName, setBaseName] = useState("");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [scale, setScale] = useState(2);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDragRejected, setIsDragRejected] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSplitting, setIsSplitting] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const isBusy = isExtracting || isSplitting;
  const baseWidth = 100;

  // --- File Loading ---

  const loadFile = async (rawFile: File) => {
    if (rawFile.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }
    setError("");
    setIsProcessing(true);
    try {
      const arrayBuffer = await rawFile.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setFile(rawFile);
      setPageCount(pdfDoc.numPages);
      setBaseName(rawFile.name.replace(/\.pdf$/i, ""));
      setSelectedPages(new Set());
    } catch {
      setError(
        "Could not read the PDF. It may be corrupted or password-protected.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileInput = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    loadFile(files[0]);
  };

  const resetTool = () => {
    setFile(null);
    setPageCount(0);
    setBaseName("");
    setSelectedPages(new Set());
    setError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Selection ---

  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      next.has(pageNum) ? next.delete(pageNum) : next.add(pageNum);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedPages(
      new Set(Array.from({ length: pageCount }, (_, i) => i + 1)),
    );

  const selectNone = () => setSelectedPages(new Set());

  // --- Download helpers ---

  const triggerDownload = (
    bytes: Uint8Array,
    filename: string,
    mimeType: string,
  ) => {
    const blob = new Blob([bytes as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Actions ---

  // Renders one page from an already-loaded pdfjs document → JPEG bytes + dimensions.
  const rasterizePage = async (
    pdfJsDoc: pdfjsLib.PDFDocumentProxy,
    pageNumber: number, // 1-based
  ): Promise<{ jpegBytes: Uint8Array; width: number; height: number }> => {
    const page = await pdfJsDoc.getPage(pageNumber);
    const origViewport = page.getViewport({ scale: 1 });
    const renderViewport = page.getViewport({ scale: 2 }); // 2× for quality

    const canvas = document.createElement("canvas");
    canvas.width = renderViewport.width;
    canvas.height = renderViewport.height;
    await page.render({
      canvasContext: canvas.getContext("2d")!,
      viewport: renderViewport,
      canvas,
    }).promise;

    const blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), "image/jpeg", 0.92),
    );
    return {
      jpegBytes: new Uint8Array(await blob.arrayBuffer()),
      width: origViewport.width,
      height: origViewport.height,
    };
  };

  const extractSelected = async () => {
    if (!file || selectedPages.size === 0) return;
    setIsExtracting(true);
    setError("");
    try {
      // slice(0) so neither pdf-lib nor pdfjs detaches the original buffer
      const arrayBuffer = await file.arrayBuffer();

      const probe = await PDFDocument.load(arrayBuffer.slice(0));
      const actualPageCount = probe.getPageCount();

      const pageIndices = [...selectedPages]
        .map((p) => p - 1)
        .filter((i) => i >= 0 && i < actualPageCount)
        .sort((a, b) => a - b);

      const result = await PDFDocument.create();

      // --- Vector path ---
      try {
        const src = await PDFDocument.load(arrayBuffer.slice(0));
        const copies = await result.copyPages(src, pageIndices);
        copies.forEach((p) => result.addPage(p));
      } catch {
        // Non-standard page tree — rasterize via pdfjs (load once for all pages)
        const pdfJsDoc = await pdfjsLib
          .getDocument({ data: arrayBuffer.slice(0) })
          .promise;
        for (const i of pageIndices) {
          const { jpegBytes, width, height } = await rasterizePage(
            pdfJsDoc,
            i + 1,
          );
          const img = await result.embedJpg(jpegBytes as any);
          const p = result.addPage([width, height]);
          p.drawImage(img, { x: 0, y: 0, width, height });
        }
      }

      const pdfBytes = await result.save();
      triggerDownload(pdfBytes, `${baseName}_extracted.pdf`, "application/pdf");
    } catch (err) {
      console.error("extractSelected error:", err);
      setError("Failed to extract pages. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const splitAllPages = async () => {
    if (!file) return;
    setIsSplitting(true);
    setError("");
    try {
      // slice(0) so neither pdf-lib nor pdfjs detaches the original buffer
      const arrayBuffer = await file.arrayBuffer();

      const probe = await PDFDocument.load(arrayBuffer.slice(0));
      const actualPageCount = probe.getPageCount();
      const zip = new JSZip();
      const padWidth = String(actualPageCount).length;

      // --- Vector path ---
      let vectorSucceeded = false;
      try {
        const sourcePdf = await PDFDocument.load(arrayBuffer.slice(0));
        for (let i = 0; i < actualPageCount; i++) {
          const singleDoc = await PDFDocument.create();
          const [copied] = await singleDoc.copyPages(sourcePdf, [i]);
          singleDoc.addPage(copied);
          const bytes = await singleDoc.save();
          zip.file(`${baseName}_page_${String(i + 1).padStart(padWidth, "0")}.pdf`, bytes);
        }
        vectorSucceeded = true;
      } catch {
        // Non-standard page tree — fall through to raster path
      }

      // --- Raster fallback (load pdfjs once for all pages) ---
      if (!vectorSucceeded) {
        const pdfJsDoc = await pdfjsLib
          .getDocument({ data: arrayBuffer.slice(0) })
          .promise;
        const rasterPageCount = pdfJsDoc.numPages;
        const rasterPadWidth = String(rasterPageCount).length;

        for (let i = 0; i < rasterPageCount; i++) {
          const { jpegBytes, width, height } = await rasterizePage(
            pdfJsDoc,
            i + 1,
          );
          const singleDoc = await PDFDocument.create();
          const img = await singleDoc.embedJpg(jpegBytes as any);
          const p = singleDoc.addPage([width, height]);
          p.drawImage(img, { x: 0, y: 0, width, height });
          const bytes = await singleDoc.save();
          zip.file(`${baseName}_page_${String(i + 1).padStart(rasterPadWidth, "0")}.pdf`, bytes);
        }
      }

      const zipBytes = await zip.generateAsync({ type: "uint8array" });
      triggerDownload(zipBytes, `${baseName}_pages.zip`, "application/zip");
    } catch (err) {
      console.error("splitAllPages error:", err);
      setError("Failed to split the PDF. Please try again.");
    } finally {
      setIsSplitting(false);
    }
  };

  // --- Drag & Drop ---

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      const items = Array.from(e.dataTransfer.items);
      const valid = !items.length || items.every(i => i.kind === "file" && i.type === "application/pdf");
      setIsDraggingFile(valid);
      setIsDragRejected(!valid);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDraggingFile(false);
      setIsDragRejected(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer.items);
    const valid = !items.length || items.every(i => i.kind === "file" && i.type === "application/pdf");
    if (valid) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    setIsDragRejected(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type === "application/pdf") loadFile(dropped);
  };

  // --- Error banner ---

  const ErrorBanner = () =>
    error ? (
      <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
        <AlertCircle size={16} className="shrink-0" />
        <span className="flex-1">{error}</span>
        <button
          onClick={() => setError("")}
          className="shrink-0 hover:text-red-900"
        >
          <X size={14} />
        </button>
      </div>
    ) : null;

  // --- Upload screen ---

  if (!file) {
    return (
      <div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Split PDF</h2>
        <p className="text-gray-500 mb-8">
          Extract specific pages or split every page into a separate PDF.
        </p>

        <ErrorBanner />

        <div
          className={`border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-150 outline-none
            ${isDragRejected ? "border-red-400 bg-red-50 cursor-not-allowed" : isDraggingFile ? "border-purple-400 bg-purple-50" : "border-gray-300 hover:border-purple-300 hover:bg-purple-50/40"}
            ${isProcessing ? "pointer-events-none opacity-60" : ""}`}
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ")
              fileInputRef.current?.click();
          }}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          tabIndex={0}
          role="button"
        >
          {isProcessing ? (
            <>
              <Loader2
                size={40}
                className="text-purple-400 animate-spin"
              />
              <p className="text-gray-500 text-sm">Loading PDF...</p>
            </>
          ) : (
            <>
              <UploadCloud
                size={48}
                className={isDragRejected ? "text-red-400" : isDraggingFile ? "text-purple-400" : "text-gray-300"}
              />
              <div className="text-center">
                <p className={`font-medium ${isDragRejected ? "text-red-500" : "text-gray-600"}`}>
                  {isDragRejected ? "PDF only — other files not accepted" : "Drop a PDF here or click to upload"}
                </p>
                <p className="text-gray-400 text-sm mt-1">
                  {isDragRejected ? "" : "PDF files only"}
                </p>
              </div>
            </>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFileInput(e.target.files)}
        />
      </div>
    );
  }

  // --- Pages screen ---

  return (
    <div>
      <div className="flex items-start gap-6">
        {/* Left: page grid */}
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-800">Split PDF</h2>
            <p className="text-gray-500 mt-1">
              Click pages to select them, then extract or split below.
            </p>
          </div>

          <ErrorBanner />

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white hover:bg-gray-50 transition-colors"
            >
              Select None
            </button>
            <span className="text-sm text-gray-400">
              {selectedPages.size} of {pageCount} selected
            </span>

            <div className="flex-1" />

            {/* Zoom slider */}
            <div className="flex items-center gap-2">
              <ZoomOut size={16} className="text-gray-400" />
              <input
                type="range"
                min={1}
                max={6}
                step={0.5}
                value={scale}
                onChange={(e) => setScale(Number(e.target.value))}
                className="w-24 accent-purple-500"
              />
              <ZoomIn size={16} className="text-gray-400" />
            </div>
          </div>

          {/* Page grid */}
          <div
            className="grid gap-3"
            style={{
              gridTemplateColumns: `repeat(auto-fill, minmax(${baseWidth * scale}px, 1fr))`,
            }}
          >
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(
              (pageNum) => {
                const isSelected = selectedPages.has(pageNum);
                return (
                  <div
                    key={pageNum}
                    onClick={() => togglePage(pageNum)}
                    className={`relative cursor-pointer rounded-lg border-2 overflow-hidden transition-all select-none
                      ${isSelected ? "border-purple-500 shadow-md shadow-purple-100" : "border-gray-200 hover:border-purple-300"}`}
                    style={{ aspectRatio: "0.707" }}
                  >
                    <PdfPageThumbnail
                      file={file}
                      pageNumber={pageNum}
                      width={baseWidth * scale}
                    />

                    {/* Selection checkmark */}
                    <div
                      className={`absolute top-1.5 right-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all
                        ${isSelected ? "bg-purple-500 border-purple-500" : "bg-white/80 border-gray-300"}`}
                    >
                      {isSelected && (
                        <Check size={10} className="text-white" strokeWidth={3} />
                      )}
                    </div>

                    {/* Page number */}
                    <div className="absolute bottom-0 left-0 right-0 text-center text-xs text-gray-500 bg-white/80 py-0.5">
                      {pageNum}
                    </div>
                  </div>
                );
              },
            )}
          </div>
        </div>

        {/* Right: sidebar */}
        <div className="w-56 shrink-0 lg:sticky lg:top-24 flex flex-col gap-3">
          {/* File info */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start gap-2">
              <FileText size={20} className="text-purple-500 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p
                  className="text-sm font-medium text-gray-800 truncate"
                  title={file.name}
                >
                  {truncateFilename(file.name, 22)}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {pageCount} {pageCount === 1 ? "page" : "pages"}
                </p>
              </div>
            </div>
          </div>

          {/* Extract Selected */}
          <button
            onClick={extractSelected}
            disabled={selectedPages.size === 0 || isBusy}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isExtracting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Extracting...
              </>
            ) : (
              <>
                <Scissors size={14} />
                {selectedPages.size > 0
                  ? `Extract ${selectedPages.size} page${selectedPages.size > 1 ? "s" : ""}`
                  : "Extract Selected"}
              </>
            )}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-2">
            <div className="flex-1 border-t border-gray-100" />
            <span className="text-xs text-gray-300">or</span>
            <div className="flex-1 border-t border-gray-100" />
          </div>

          {/* Split All */}
          <div className="flex flex-col gap-1">
            <button
              onClick={splitAllPages}
              disabled={isBusy}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-purple-300 text-purple-700 rounded-xl text-sm font-medium hover:bg-purple-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isSplitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Splitting...
                </>
              ) : (
                <>
                  <FileDown size={14} />
                  Split All Pages
                </>
              )}
            </button>
            <p className="text-xs text-gray-400 text-center">
              Downloads as a .zip file
            </p>
          </div>

          {/* Upload different PDF */}
          <button
            onClick={resetTool}
            className="w-full mt-1 text-xs text-gray-400 hover:text-gray-600 transition-colors py-1.5 border border-dashed border-gray-200 rounded-xl hover:border-gray-300"
          >
            Upload different PDF
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => handleFileInput(e.target.files)}
          />
        </div>
      </div>
    </div>
  );
}
