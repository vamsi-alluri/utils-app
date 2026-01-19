import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm"; // Adds support for tables, lists, etc.
import { config } from "../config";

export default function JDScreener() {
  const [jd, setJd] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const analyzeJD = async () => {
    if (!jd) return;
    setLoading(true);

    try {
      const res = await fetch(config.api.jdScreenerUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd: jd }), // Ensure this matches your API expectation
      });

      const data = await res.get("markdown");
      setResponse(data);
    } catch (error) {
      console.error(error);
      setResponse("Error contacting the bot. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <h2>JD Screener Bot</h2>

      <textarea
        value={jd}
        onChange={(e) => setJd(e.target.value)}
        placeholder="Paste Job Description here..."
        rows={10}
        style={{ width: "100%", marginBottom: "10px", padding: "10px" }}
      />

      <button
        onClick={analyzeJD}
        disabled={loading}
        style={{
          padding: "10px 20px",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Analyzing (waking up bot)..." : "Analyze JD"}
      </button>

      {response && (
        <div
          style={{
            marginTop: "30px",
            borderTop: "1px solid #ccc",
            paddingTop: "20px",
          }}
        >
          <h3>Analysis Result:</h3>
          {/* This renders the Markdown safely */}
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {response}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
