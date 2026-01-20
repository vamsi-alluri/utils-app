import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Upload, File, CheckCircle, X } from "griddy-icons";
import jsPDF from "jspdf";

export default function JpgToPdf() {
  const [file, setFile] = useState<File | null>(null);
  const [pageSize, setPageSize] = useState<"a4" | "letter">("a4"); // <--- New State
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");
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

  const validateAndSetFile = (selectedFile: File) => {
    setError("");
    if (!selectedFile.type.match(/image\/jpe?g/)) {
      setError("Please upload a valid JPG or JPEG file.");
      setFile(null);
      return;
    }
    setFile(selectedFile);
  };

  const clearFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // --- Conversion Logic ---

  const convertToPdf = async () => {
    if (!file) return;
    setIsConverting(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);

      reader.onload = (event) => {
        const imgData = event.target?.result as string;

        const img = new Image();
        img.src = imgData;

        img.onload = () => {
          // Pass the selected pageSize ("a4" or "letter") to jsPDF
          const pdf = new jsPDF("p", "mm", pageSize);

          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 10;

          const maxImgWidth = pageWidth - margin * 2;
          const maxImgHeight = pageHeight - margin * 2;

          let imgWidth = img.width;
          let imgHeight = img.height;

          const ratio = Math.min(
            maxImgWidth / imgWidth,
            maxImgHeight / imgHeight,
          );

          const finalWidth = imgWidth * ratio;
          const finalHeight = imgHeight * ratio;

          const x = (pageWidth - finalWidth) / 2;
          const y = (pageHeight - finalHeight) / 2;

          pdf.addImage(imgData, "JPEG", x, y, finalWidth, finalHeight);
          pdf.save(`${file.name.replace(/\.[^/.]+$/, "")}_${pageSize}.pdf`);

          setIsConverting(false);
        };
      };
    } catch (err) {
      console.error(err);
      setError("Failed to convert image.");
      setIsConverting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-10">
      <Link
        to="/pdf"
        className="text-sm text-red-600 hover:underline mb-4 block"
      >
        &larr; Back to PDF Tools
      </Link>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-200 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">JPG to PDF</h1>
        <p className="text-gray-500 mb-8">
          Convert your image to a PDF file instantly.
        </p>

        {/* --- Upload Zone --- */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className={`
            relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer mb-6
            ${error ? "border-red-300 bg-red-50" : "border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-red-400"}
          `}
        >
          {file ? (
            <div className="flex flex-col items-center animate-fade-in">
              <div className="h-16 w-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-4">
                <File size={32} />
              </div>
              <span className="text-lg font-medium text-gray-800 break-all">
                {file.name}
              </span>
              <span className="text-sm text-gray-500 mt-1">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </span>

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
                <Upload size={48} />
              </div>
              <span className="block text-sm font-medium text-gray-700">
                Click to upload JPG
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
            accept="image/jpeg, image/jpg"
            onChange={handleFileSelect}
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4 font-medium">{error}</p>
        )}

        {/* --- Paper Size Selector --- */}
        <div className="mb-6 flex justify-center items-center gap-3">
          <span className="text-sm font-medium text-gray-600">Paper Size:</span>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              onClick={() => setPageSize("a4")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                pageSize === "a4"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              A4
            </button>
            <button
              onClick={() => setPageSize("letter")}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                pageSize === "letter"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Letter
            </button>
          </div>
        </div>

        {/* --- Action Button --- */}
        <button
          onClick={convertToPdf}
          disabled={!file || isConverting}
          className={`
            w-full font-semibold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2
            ${
              !file || isConverting
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : "bg-red-600 text-white hover:bg-red-700 hover:shadow-lg active:transform active:scale-95"
            }
          `}
        >
          {isConverting ? (
            <>Processing...</>
          ) : (
            <>
              {file && <CheckCircle size={20} />}
              Convert to PDF
            </>
          )}
        </button>
      </div>
    </div>
  );
}
