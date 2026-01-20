import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { config } from "@/config";
import { getToken } from "@/helpers/firebase";

export default function JdScreener() {
  const [jd, setJd] = useState("");
  const [response, setResponse] = useState("Analyze to get a response.");
  const [loading, setLoading] = useState(false);

  const analyzeJD = async () => {
    if (!jd) return;
    setLoading(true);

    try {
      // 1. Get the Firebase Token
      const token = await getToken();

      if (!token) {
        setResponse("Error: You are not authenticated.");
        setLoading(false);
        return;
      }

      // 2. Send it in the Authorization Header
      const res = await fetch(config.api.jdScreenerUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // <--- THE KEY CHANGE
        },
        body: JSON.stringify({ jd: jd }),
      });

      if (!res.ok) {
        // Handle 401 Unauthorized or 500 errors gracefully
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
      <h2 className="text-2xl font-bold mb-4">JD Screener Bot</h2>

      <textarea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Paste Job Description here..."
        rows={10}
        className="w-full p-3 border border-gray-300 rounded mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <button
        onClick={analyzeJD}
        disabled={loading}
        className={`px-6 py-2 text-white rounded transition-colors ${
          loading
            ? "bg-gray-400 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 pointer"
        }`}
      >
        {loading ? "Analyzing (waking up bot)..." : "Analyze JD"}
      </button>

      {response && (
        <div className="mt-8 border-t border-gray-200 pt-6">
          <h3 className="text-xl font-semibold mb-4">Analysis Result:</h3>
          <div className="markdown-body prose max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
