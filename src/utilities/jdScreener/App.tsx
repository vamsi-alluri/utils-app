import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react"; // <--- Import from lucide-react
import { config } from "@/config";
import { getToken } from "@/helpers/firebase";
import Loader from "@/components/Loader";

export default function JdScreener() {
  const [jd, setJd] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const analyzeJD = async () => {
    if (!jd) return;
    setLoading(true);
    setResponse("");

    try {
      const token = await getToken();

      if (!token) {
        setResponse("Error: You are not authenticated.");
        setLoading(false);
        return;
      }

      const res = await fetch(config.api.jdScreenerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ jd: jd }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      setResponse(data.markdown);
    } catch (error) {
      console.error(error);
      setResponse(
        "Error contacting the bot. Please ensure you are logged in and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-5">
      {/* Header Section */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900">JD Screener Bot</h2>
        <p className="text-gray-500 mt-2">
          Paste a job description below to get an AI-analyzed compatibility
          report.
        </p>
      </div>

      {/* Input Section */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <textarea
          value={jd}
          onChange={(e) => setJd(e.target.value)}
          placeholder="Paste Job Description here..."
          rows={10}
          className="w-full p-4 border border-gray-200 rounded-xl mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm resize-y"
        />

        <div className="flex justify-end">
          <button
            onClick={analyzeJD}
            disabled={loading || !jd.trim()}
            className={`
              flex items-center gap-2 px-8 py-3 rounded-lg font-semibold transition-all
              ${
                loading || !jd.trim()
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md active:scale-95"
              }
            `}
          >
            {loading ? (
              <span>Processing...</span>
            ) : (
              <>
                <span>Analyze Job Description</span>
                <Sparkles className="w-5 h-5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Response / Loading Section */}
      <div className="mt-8">
        {loading ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12">
            <Loader text="Analyzing keywords and requirements (this may take 10-20s for cold starts)..." />
          </div>
        ) : response ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm animate-fade-in">
            <h3 className="text-xl font-bold text-gray-800 mb-6 pb-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-2xl">📋</span> Analysis Result
            </h3>
            {/* Added 'prose' classes for Markdown styling */}
            <div className="markdown-body prose prose-blue max-w-none prose-headings:font-bold prose-a:text-blue-600 prose-p:text-gray-700">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {response}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-400 border-2 border-dashed border-gray-200 rounded-2xl">
            <p>Result will appear here</p>
          </div>
        )}
      </div>
    </div>
  );
}
