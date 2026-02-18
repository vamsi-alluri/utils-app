import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Sparkles } from "lucide-react";
import { config } from "@/config";
import { fetchWithRetry } from "@/helpers/api";
import {
  setFaviconLoading,
  setFaviconDone,
  resetFavicon,
} from "@/helpers/favicon";
import { playNotificationSound } from "@/helpers/notificationSound";
import Loader from "@/components/Loader";

interface JdScreenerResponse {
  markdown: string;
  resume_count: number;
  model: string;
  timestamp: string;
}

interface AnalysisMetadata {
  resumeCount: number;
  model: string;
  timestamp: string;
}

export default function JdScreener() {
  const [jd, setJd] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<AnalysisMetadata | null>(null);
  const [hasSeenResponse, setHasSeenResponse] = useState(false);

  // Reset favicon when component unmounts
  useEffect(() => {
    return () => {
      resetFavicon();
    };
  }, []);

  // Track page visibility to reset notification state when user views the page
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (
        document.visibilityState === "visible" &&
        response &&
        !hasSeenResponse
      ) {
        // User has returned to the page, mark as seen
        setHasSeenResponse(true);
        resetFavicon();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [response, hasSeenResponse]);

  // Mark response as seen when user scrolls or interacts
  useEffect(() => {
    if (response && !hasSeenResponse) {
      const handleInteraction = () => {
        setHasSeenResponse(true);
        resetFavicon();
      };

      // Add listeners for user interaction
      window.addEventListener("scroll", handleInteraction, { once: true });
      window.addEventListener("click", handleInteraction, { once: true });
      window.addEventListener("keydown", handleInteraction, { once: true });

      return () => {
        window.removeEventListener("scroll", handleInteraction);
        window.removeEventListener("click", handleInteraction);
        window.removeEventListener("keydown", handleInteraction);
      };
    }
  }, [response, hasSeenResponse]);

  const analyzeJD = async () => {
    if (!jd) return;
    setLoading(true);
    setResponse("");
    setMetadata(null);
    setHasSeenResponse(false);

    // Set loading favicon
    setFaviconLoading();

    try {
      const result = await fetchWithRetry<JdScreenerResponse>(
        config.api.jdScreenerUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd }),
          retries: 2,
          retryDelay: 1000,
        },
      );

      if (result.error) {
        if (
          result.error.includes("Auth") ||
          result.status === 401 ||
          result.status === 403
        ) {
          setResponse(
            "Authentication error. Please try logging out and back in.",
          );
        } else if (result.status && result.status >= 500) {
          setResponse("Server error. Please try again in a moment.");
        } else {
          setResponse(`Error: ${result.error}. Please try again.`);
        }
        // Reset favicon on error
        resetFavicon();
        return;
      }

      if (result.data) {
        setResponse(result.data.markdown);
        setMetadata({
          resumeCount: result.data.resume_count,
          model: result.data.model,
          timestamp: result.data.timestamp,
        });

        // Play notification sound and set done favicon
        playNotificationSound();
        setFaviconDone();
      }
    } catch (error) {
      console.error(error);
      setResponse(
        "Unexpected error occurred. Please ensure you are logged in and try again.",
      );
      resetFavicon();
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
        {metadata && (
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-500">
            <span>
              Resumes analyzed:{" "}
              <strong className="text-gray-700">{metadata.resumeCount}</strong>
            </span>
            <span>
              Model: <strong className="text-gray-700">{metadata.model}</strong>
            </span>
            <span className="text-gray-400">
              {new Date(metadata.timestamp).toLocaleString()}
            </span>
          </div>
        )}
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
