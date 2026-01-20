import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import {
  UploadCloud,
  FileImage,
  CheckCircle,
  X,
  GripVertical,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import jsPDF from "jspdf";

interface ImageFile {
  id: string;
  file: File;
  preview: string;
}

export default function JpgToPdf() {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4");
  const [scale, setScale] = useState(15); // Thumbnail scale percentage
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      addFiles(Array.from(e.target.files));
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  };

  const addFiles = (files: File[]) => {
    setError("");
    const validImages: ImageFile[] = [];

    files.forEach((file) => {
      if (!file.type.match(/image\/jpe?g/)) {
        setError("Only JPG/JPEG files are allowed. Some files were skipped.");
        return;
      }

      const preview = URL.createObjectURL(file);
      validImages.push({
        id: `${Date.now()}-${Math.random()}`,
        file,
        preview,
      });
    });

    setImages((prev) => [...prev, ...validImages]);
  };

  const removeImage = (id: string) => {
    setImages((prev) => {
      const filtered = prev.filter((img) => img.id !== id);
      const removed = prev.find((img) => img.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const clearAll = () => {
    images.forEach((img) => URL.revokeObjectURL(img.preview));
    setImages([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Drag and Drop Reordering ---

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newImages = [...images];
    const draggedItem = newImages[draggedIndex];
    newImages.splice(draggedIndex, 1);
    newImages.splice(index, 0, draggedItem);

    setImages(newImages);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  // --- Conversion Logic ---

  const convertToPdf = async () => {
    if (images.length === 0) return;
    setIsConverting(true);

    try {
      const pdf = new jsPDF("p", "mm", pageSize);
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const maxImgWidth = pageWidth - margin * 2;
      const maxImgHeight = pageHeight - margin * 2;

      for (let i = 0; i < images.length; i++) {
        const imageFile = images[i];

        // Load image and get dimensions
        await new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.src = imageFile.preview;

          img.onload = () => {
            const ratio = Math.min(
              maxImgWidth / img.width,
              maxImgHeight / img.height,
            );
            const finalWidth = img.width * ratio;
            const finalHeight = img.height * ratio;
            const x = (pageWidth - finalWidth) / 2;
            const y = (pageHeight - finalHeight) / 2;

            if (i > 0) pdf.addPage();
            pdf.addImage(
              imageFile.preview,
              "JPEG",
              x,
              y,
              finalWidth,
              finalHeight,
            );
            resolve();
          };

          img.onerror = () => reject(new Error("Failed to load image"));
        });
      }

      const timestamp = new Date().toISOString().slice(0, 10);
      pdf.save(`converted_${timestamp}_${pageSize}.pdf`);
      setIsConverting(false);
    } catch (err) {
      console.error(err);
      setError("Failed to convert images to PDF.");
      setIsConverting(false);
    }
  };

  const thumbnailSize = scale; // Direct percentage

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
          JPG to PDF
        </h1>
        <p className="text-gray-500 mb-8 text-center">
          Upload multiple images, reorder them, and convert to PDF.
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
          <div className="flex flex-col items-center">
            <div className="mx-auto h-12 w-12 text-gray-400 mb-3">
              <UploadCloud size={48} />
            </div>
            <span className="block text-sm font-medium text-gray-700">
              Click to upload JPG images
            </span>
            <span className="block text-xs text-gray-400 mt-1">
              or drag and drop multiple files here
            </span>
            {images.length > 0 && (
              <span className="block text-sm text-blue-600 font-medium mt-2">
                {images.length} image{images.length > 1 ? "s" : ""} selected
              </span>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg, image/jpg"
            onChange={handleFileSelect}
            multiple
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 font-medium text-center">
            {error}
          </p>
        )}

        {/* --- Controls Row --- */}
        {images.length > 0 && (
          <div className="mb-6 flex flex-wrap justify-between items-center gap-4">
            {/* Paper Size Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                Paper Size:
              </span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  onClick={() => setPageSize("a4")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    pageSize === "a4"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  A4
                </button>
                <button
                  onClick={() => setPageSize("letter")}
                  className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                    pageSize === "letter"
                      ? "bg-white text-blue-600 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  Letter
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
              <span className="text-sm font-medium text-gray-600 min-w-[3rem]">
                {scale}%
              </span>
            </div>

            {/* Clear All Button */}
            <button
              onClick={clearAll}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear All
            </button>
          </div>
        )}

        {/* --- Image Grid --- */}
        {images.length > 0 && (
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            {images.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={`
                  relative group cursor-move bg-white rounded-lg shadow-sm border-2 transition-all flex-shrink-0
                  ${draggedIndex === index ? "opacity-50 border-blue-400" : "border-gray-200 hover:border-blue-300"}
                `}
                style={{
                  width: `calc(${thumbnailSize}% - 1rem)`,
                  minWidth: "64px",
                }}
              >
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center z-10">
                  {index + 1}
                </div>

                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                  <button
                    onClick={() => removeImage(img.id)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                    title="Remove"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical size={24} className="text-gray-400" />
                </div>

                <img
                  src={img.preview}
                  alt={`Preview ${index + 1}`}
                  className="w-full h-auto object-contain rounded-lg"
                />

                <div className="p-2 text-xs text-gray-600 truncate">
                  {img.file.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* --- Action Button --- */}
        <button
          onClick={convertToPdf}
          disabled={images.length === 0 || isConverting}
          className={`
            w-full font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2
            ${
              images.length === 0 || isConverting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-lg active:transform active:scale-95"
            }
          `}
        >
          {isConverting ? (
            <>
              Processing {images.length} image{images.length > 1 ? "s" : ""}...
            </>
          ) : (
            <>
              {images.length > 0 && <CheckCircle size={20} />}
              Convert to PDF ({images.length} image
              {images.length > 1 ? "s" : ""})
            </>
          )}
        </button>
      </div>
    </div>
  );
}
