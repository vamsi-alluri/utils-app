import { Link } from "react-router-dom";
// Importing icons from the new package
import { File, FileText, Layers } from "griddy-icons";

export default function PdfHome() {
  const tools = [
    {
      id: "j2p",
      title: "JPG to PDF",
      desc: "Convert a single image into a PDF document.",
      path: "j2p",
      // Using red theme to match PDF/Image logic
      color: "bg-red-50 text-red-600 hover:border-red-200",
      icon: <File size={32} />, // Griddy icons usually accept a size prop
    },
    {
      id: "p2j",
      title: "PDF to JPG",
      desc: "Extract pages from a PDF and download as a ZIP.",
      path: "p2j",
      // Using blue theme
      color: "bg-blue-50 text-blue-600 hover:border-blue-200",
      icon: <FileText size={32} />,
    },
    {
      id: "merge",
      title: "Merge PDF",
      desc: "Coming Soon...",
      path: "#",
      color: "bg-gray-50 text-gray-400 cursor-not-allowed opacity-60",
      icon: <Layers size={32} />,
    },
  ];

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-2">PDF Tools</h2>
      <p className="text-gray-500 mb-8">Select a tool to get started.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            to={tool.path}
            className={`block p-8 rounded-xl border border-transparent transition-all duration-200
              ${tool.color}
              ${tool.path !== "#" ? "hover:shadow-lg hover:scale-105 border-gray-100 bg-white" : ""}`}
          >
            {/* Icon Container */}
            <div className="mb-4 opacity-80">{tool.icon}</div>

            <h3 className="text-xl font-bold mb-2 text-gray-900">
              {tool.title}
            </h3>
            <p className="text-sm text-gray-600">{tool.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
