import { useState, useRef, useEffect } from "react";
import { Send, Bot, Sparkles, TerminalSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const SUGGESTIONS = [
  "Why do I keep failing Tree problems?",
  "How many compile errors did I get?",
  "What is my failure rate in Trees?",
  "What mistakes am I repeating?"
];

export default function QuerySection({ onAsk, isLoading, streamText, mode }) {
  const [query, setQuery] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "auto" });
  }, [streamText]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim() && !isLoading) {
      onAsk(query);
    }
  };

  return (
    <div className="glass-panel p-6 flex flex-col h-full flex-1">
      <div className="flex items-center gap-3 mb-4">
        <Bot className="w-6 h-6 text-indigo-400" />
        <h2 className="text-lg font-semibold text-white">AI Mentor</h2>
        {mode && (
          <span className={`ml-auto px-2.5 py-1 text-xs font-bold rounded-md border ${
            mode === "CONTEXTUAL" 
              ? "bg-violet-500/20 text-violet-300 border-violet-500/30" 
              : "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
          }`}>
            {mode === "CONTEXTUAL" ? "GraphRAG Active" : "Text-to-Cypher"}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto mb-4 pr-2 space-y-4">
        {streamText ? (
          <div className="text-slate-300 text-sm leading-relaxed prose prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {streamText}
            </ReactMarkdown>
            <div ref={endRef} />
          </div>
        ) : isLoading ? (
          <div className="h-full flex flex-col items-start justify-start">
            <div className="flex items-center gap-1.5 text-indigo-400 mt-2 bg-indigo-500/10 px-4 py-3 rounded-2xl rounded-tl-sm w-fit">
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></div>
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 gap-4">
            <Sparkles className="w-10 h-10 opacity-50" />
            <p>Ask me anything about your coding history.</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4 max-w-md">
              {SUGGESTIONS.map((s, i) => (
                <button 
                  key={i} 
                  onClick={() => setQuery(s)}
                  className="text-xs bg-slate-800/50 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-full border border-slate-700/50 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative mt-auto">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <TerminalSquare className="w-5 h-5 text-slate-500" />
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question..."
          className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          disabled={isLoading}
        />
        <button 
          type="submit"
          disabled={!query.trim() || isLoading}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-md transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}
