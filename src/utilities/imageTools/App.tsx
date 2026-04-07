import { useState, useRef, useCallback, useEffect } from "react";
import { Crop, Download, Upload, Scissors, Maximize2, X } from "lucide-react";

type Unit = "pixels" | "inches" | "cms";
type AspectRatio = "free" | "1:1" | "4:3" | "16:9" | "3:2" | "2:3" | "custom";

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Dimensions {
  width: number;
  height: number;
  unit: Unit;
}

const ASPECT_RATIOS: Record<AspectRatio, number | null> = {
  free: null,
  "1:1": 1,
  "4:3": 4 / 3,
  "16:9": 16 / 9,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
  custom: null,
};

const PPI = 96; // Standard screen PPI
const CM_TO_INCH = 0.393701;

function convertToPixels(value: number, unit: Unit): number {
  switch (unit) {
    case "inches":
      return value * PPI;
    case "cms":
      return value * CM_TO_INCH * PPI;
    default:
      return value;
  }
}

function convertFromPixels(value: number, unit: Unit): number {
  switch (unit) {
    case "inches":
      return value / PPI;
    case "cms":
      return value / PPI / CM_TO_INCH;
    default:
      return value;
  }
}

export default function ImageTools() {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [mode, setMode] = useState<"crop" | "resize">("crop");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("free");
  const [cropArea, setCropArea] = useState<CropArea>({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
  });
  const [resizeDimensions, setResizeDimensions] = useState<Dimensions>({
    width: 800,
    height: 600,
    unit: "pixels",
  });
  const [unit, setUnit] = useState<Unit>("pixels");
  const [maintainAspect, setMaintainAspect] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const [isDragRejected, setIsDragRejected] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        setImage(img);
        setCropArea({ x: 0, y: 0, width: img.width, height: img.height });
        setResizeDimensions({
          width: convertFromPixels(img.width, unit),
          height: convertFromPixels(img.height, unit),
          unit,
        });
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadImageFile(file);
  };

  const isImageDrag = (e: React.DragEvent) => {
    const items = Array.from(e.dataTransfer.items);
    if (items.length === 0) return true; // can't determine, allow
    return items.every((item) => item.kind === "file" && item.type.startsWith("image/"));
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isImageDrag(e)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      setIsFileDragOver(true);
      setIsDragRejected(false);
    } else {
      // No preventDefault → browser shows full no-drop cursor; drop event won't fire
      setIsFileDragOver(false);
      setIsDragRejected(true);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsFileDragOver(false);
    setIsDragRejected(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) loadImageFile(file);
  };

  const handleAspectRatioChange = (ratio: AspectRatio) => {
    setAspectRatio(ratio);
    if (ratio !== "free" && ratio !== "custom" && image) {
      const targetRatio = ASPECT_RATIOS[ratio]!;
      const currentRatio = cropArea.width / cropArea.height;

      if (currentRatio > targetRatio) {
        // Width is too large
        const newWidth = cropArea.height * targetRatio;
        setCropArea({
          ...cropArea,
          width: newWidth,
          x: cropArea.x + (cropArea.width - newWidth) / 2,
        });
      } else {
        // Height is too large
        const newHeight = cropArea.width / targetRatio;
        setCropArea({
          ...cropArea,
          height: newHeight,
          y: cropArea.y + (cropArea.height - newHeight) / 2,
        });
      }
    }
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    handle?: string,
  ) => {
    e.preventDefault();
    const rect = imageContainerRef.current?.getBoundingClientRect();
    if (!rect || !image) return;

    const scaleX = image.width / rect.width;
    const scaleY = image.height / rect.height;

    if (handle) {
      setIsResizing(handle);
    } else {
      setIsDragging(true);
    }

    setDragStart({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!image || (!isDragging && !isResizing)) return;

      const rect = imageContainerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const scaleX = image.width / rect.width;
      const scaleY = image.height / rect.height;

      const currentX = (e.clientX - rect.left) * scaleX;
      const currentY = (e.clientY - rect.top) * scaleY;

      if (isDragging) {
        const deltaX = currentX - dragStart.x;
        const deltaY = currentY - dragStart.y;

        setCropArea((prev) => ({
          ...prev,
          x: Math.max(0, Math.min(image.width - prev.width, prev.x + deltaX)),
          y: Math.max(0, Math.min(image.height - prev.height, prev.y + deltaY)),
        }));

        setDragStart({ x: currentX, y: currentY });
      } else if (isResizing) {
        const targetRatio =
          aspectRatio !== "free" && aspectRatio !== "custom"
            ? ASPECT_RATIOS[aspectRatio]
            : null;

        setCropArea((prev) => {
          let newCrop = { ...prev };

          switch (isResizing) {
            case "se": // Southeast
              newCrop.width = Math.max(20, currentX - prev.x);
              newCrop.height = Math.max(20, currentY - prev.y);
              break;
            case "sw": // Southwest
              const newWidth = Math.max(20, prev.x + prev.width - currentX);
              newCrop.x = prev.x + prev.width - newWidth;
              newCrop.width = newWidth;
              newCrop.height = Math.max(20, currentY - prev.y);
              break;
            case "ne": // Northeast
              newCrop.width = Math.max(20, currentX - prev.x);
              const newHeight = Math.max(20, prev.y + prev.height - currentY);
              newCrop.y = prev.y + prev.height - newHeight;
              newCrop.height = newHeight;
              break;
            case "nw": // Northwest
              const nwWidth = Math.max(20, prev.x + prev.width - currentX);
              const nwHeight = Math.max(20, prev.y + prev.height - currentY);
              newCrop.x = prev.x + prev.width - nwWidth;
              newCrop.y = prev.y + prev.height - nwHeight;
              newCrop.width = nwWidth;
              newCrop.height = nwHeight;
              break;
          }

          // Apply aspect ratio constraint
          if (targetRatio) {
            const currentRatio = newCrop.width / newCrop.height;
            if (currentRatio > targetRatio) {
              newCrop.width = newCrop.height * targetRatio;
            } else {
              newCrop.height = newCrop.width / targetRatio;
            }
          }

          // Ensure crop stays within image bounds
          newCrop.x = Math.max(
            0,
            Math.min(image.width - newCrop.width, newCrop.x),
          );
          newCrop.y = Math.max(
            0,
            Math.min(image.height - newCrop.height, newCrop.y),
          );
          newCrop.width = Math.min(newCrop.width, image.width - newCrop.x);
          newCrop.height = Math.min(newCrop.height, image.height - newCrop.y);

          return newCrop;
        });
      }
    },
    [isDragging, isResizing, image, dragStart, aspectRatio],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(null);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleResizeDimensionChange = (
    dimension: "width" | "height",
    value: number,
  ) => {
    if (!image) return;

    const newDimensions = { ...resizeDimensions, [dimension]: value };

    if (maintainAspect) {
      const aspectRatio = image.width / image.height;
      if (dimension === "width") {
        newDimensions.height = value / aspectRatio;
      } else {
        newDimensions.width = value * aspectRatio;
      }
    }

    setResizeDimensions(newDimensions);
  };

  const handleUnitChange = (newUnit: Unit) => {
    setResizeDimensions({
      width: convertFromPixels(
        convertToPixels(resizeDimensions.width, resizeDimensions.unit),
        newUnit,
      ),
      height: convertFromPixels(
        convertToPixels(resizeDimensions.height, resizeDimensions.unit),
        newUnit,
      ),
      unit: newUnit,
    });
    setUnit(newUnit);
  };

  const processCrop = () => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    canvas.width = cropArea.width;
    canvas.height = cropArea.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(
      image,
      cropArea.x,
      cropArea.y,
      cropArea.width,
      cropArea.height,
      0,
      0,
      cropArea.width,
      cropArea.height,
    );

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `cropped-image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  const processResize = () => {
    if (!image || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const widthPx = Math.round(
      convertToPixels(resizeDimensions.width, resizeDimensions.unit),
    );
    const heightPx = Math.round(
      convertToPixels(resizeDimensions.height, resizeDimensions.unit),
    );

    canvas.width = widthPx;
    canvas.height = heightPx;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.drawImage(image, 0, 0, widthPx, heightPx);

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `resized-image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  const resetImage = () => {
    setImage(null);
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-8 text-white">
          <div className="flex items-center gap-3 mb-2">
            <Scissors className="w-8 h-8" />
            <h1 className="text-3xl font-bold">Image Tools</h1>
          </div>
          <p className="text-purple-100">
            Crop and resize images with precision
          </p>
        </div>

        {/* Mode Selector */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex gap-2">
            <button
              onClick={() => setMode("crop")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mode === "crop"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Crop className="w-4 h-4" />
              Crop
            </button>
            <button
              onClick={() => setMode("resize")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                mode === "resize"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              <Maximize2 className="w-4 h-4" />
              Resize
            </button>
          </div>
        </div>

        <div className="p-6">
          {!image ? (
            /* Upload Area */
            <div
              onClick={() => !isDragRejected && fileInputRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={() => { setIsFileDragOver(false); setIsDragRejected(false); }}
              onDrop={handleFileDrop}
              className={`relative border-2 rounded-xl p-12 transition-all text-center ${
                isDragRejected
                  ? "border-dashed border-red-400 bg-red-50 cursor-not-allowed"
                  : "border-transparent cursor-pointer bg-gray-50 hover:bg-gray-100"
              }`}
            >
              {/* SVG gradient dashed border — only when not rejected */}
              {!isDragRejected && (
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                >
                  <defs>
                    <linearGradient
                      id="upload-border-grad"
                      x1="0" y1="0" x2="1" y2="0"
                      gradientUnits="objectBoundingBox"
                    >
                      <stop offset="0%" style={{ stopColor: "var(--color-purple-600)" }} />
                      <stop offset="100%" style={{ stopColor: "var(--color-blue-600)" }} />
                    </linearGradient>
                  </defs>
                  <rect
                    x="1" y="1"
                    style={{ width: "calc(100% - 2px)", height: "calc(100% - 2px)" }}
                    rx="11" ry="11"
                    fill={isFileDragOver ? "var(--color-purple-50)" : "none"}
                    stroke="url(#upload-border-grad)"
                    strokeWidth="2"
                    strokeDasharray="8 5"
                  />
                </svg>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                  <Upload className="w-7 h-7 text-white" />
                </div>
                <div>
                  <p className={`text-sm font-medium ${isDragRejected ? "text-red-500" : "text-gray-700"}`}>
                    {isDragRejected ? "Images only — other files not accepted" : "Click to upload an image"}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {isDragRejected ? "" : "or drag and drop here"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Controls */}
              {mode === "crop" ? (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Aspect Ratio
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {(Object.keys(ASPECT_RATIOS) as AspectRatio[]).map(
                        (ratio) => (
                          <button
                            key={ratio}
                            onClick={() => handleAspectRatioChange(ratio)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                              aspectRatio === ratio
                                ? "bg-purple-600 text-white shadow-sm"
                                : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                            }`}
                          >
                            {ratio === "free"
                              ? "Free"
                              : ratio === "custom"
                                ? "Custom"
                                : ratio}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Width
                      </label>
                      <div className="text-lg font-semibold text-gray-900">
                        {Math.round(cropArea.width)} px
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Height
                      </label>
                      <div className="text-lg font-semibold text-gray-900">
                        {Math.round(cropArea.height)} px
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Unit
                    </label>
                    <div className="flex gap-2">
                      {(["pixels", "inches", "cms"] as Unit[]).map((u) => (
                        <button
                          key={u}
                          onClick={() => handleUnitChange(u)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            resizeDimensions.unit === u
                              ? "bg-purple-600 text-white shadow-sm"
                              : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                          }`}
                        >
                          {u.charAt(0).toUpperCase() + u.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <input
                      type="checkbox"
                      id="maintain-aspect"
                      checked={maintainAspect}
                      onChange={(e) => setMaintainAspect(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor="maintain-aspect"
                      className="text-sm font-medium text-gray-700"
                    >
                      Maintain aspect ratio
                    </label>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Width
                      </label>
                      <input
                        type="number"
                        value={resizeDimensions.width.toFixed(2)}
                        onChange={(e) =>
                          handleResizeDimensionChange(
                            "width",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Height
                      </label>
                      <input
                        type="number"
                        value={resizeDimensions.height.toFixed(2)}
                        onChange={(e) =>
                          handleResizeDimensionChange(
                            "height",
                            parseFloat(e.target.value) || 0,
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        step="0.01"
                        disabled={maintainAspect}
                      />
                    </div>
                  </div>

                  <div className="text-sm text-gray-600 bg-white p-3 rounded-lg border border-gray-200">
                    <div className="font-medium mb-1">Output size:</div>
                    <div>
                      {Math.round(
                        convertToPixels(
                          resizeDimensions.width,
                          resizeDimensions.unit,
                        ),
                      )}{" "}
                      x{" "}
                      {Math.round(
                        convertToPixels(
                          resizeDimensions.height,
                          resizeDimensions.unit,
                        ),
                      )}{" "}
                      pixels
                    </div>
                  </div>
                </div>
              )}

              {/* Image Preview */}
              <div className="bg-gray-100 rounded-lg p-4 border-2 border-dashed border-gray-300">
                <div
                  ref={imageContainerRef}
                  className="relative mx-auto"
                  style={{
                    maxWidth: "100%",
                    maxHeight: "500px",
                    width: "fit-content",
                  }}
                >
                  <img
                    src={image.src}
                    alt="Preview"
                    className="max-w-full max-h-[500px] block select-none"
                    draggable={false}
                  />

                  {mode === "crop" && (
                    <div
                      className="absolute border-2 border-purple-600 cursor-move"
                      style={{
                        left: `${(cropArea.x / image.width) * 100}%`,
                        top: `${(cropArea.y / image.height) * 100}%`,
                        width: `${(cropArea.width / image.width) * 100}%`,
                        height: `${(cropArea.height / image.height) * 100}%`,
                        boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.5)",
                      }}
                      onMouseDown={(e) => handleMouseDown(e)}
                    >
                      {/* Corner handles */}
                      {["nw", "ne", "sw", "se"].map((handle) => (
                        <div
                          key={handle}
                          className="absolute w-4 h-4 bg-white border-2 border-purple-600 rounded-full cursor-pointer hover:scale-125 transition-transform"
                          style={{
                            [handle.includes("n") ? "top" : "bottom"]: "-8px",
                            [handle.includes("w") ? "left" : "right"]: "-8px",
                          }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            handleMouseDown(e, handle);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={mode === "crop" ? processCrop : processResize}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors shadow-sm"
                >
                  <Download className="w-5 h-5" />
                  Download {mode === "crop" ? "Cropped" : "Resized"} Image
                </button>
                <button
                  onClick={resetImage}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  <X className="w-5 h-5" />
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
