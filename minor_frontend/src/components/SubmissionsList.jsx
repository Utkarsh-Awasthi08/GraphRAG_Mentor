import { ExternalLink, Tag, Clock } from "lucide-react";
import { cn, getStatusColor, formatDate } from "../utils/helpers";

export default function SubmissionsList({ data }) {
  if (!data || data.length === 0) return null;

  // Only render cards if the data has 'problem' or 'status' indicating it's a submission record
  if (!data[0].status && !data[0].problem) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Retrieved Submissions (Graph Context)</h3>
      {data.map((sub, i) => (
        <div key={i} className="glass-panel p-5 relative overflow-hidden group">
          {/* Similarity Score Bar for GraphRAG */}
          {sub.similarityScore && (
            <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
              <div 
                className="h-full bg-violet-500" 
                style={{ width: `${Math.round(sub.similarityScore * 100)}%` }}
              />
            </div>
          )}

          <div className="flex justify-between items-start mb-3 mt-2">
            <div>
              <a href={sub.url} target="_blank" rel="noreferrer" className="text-lg font-bold text-white hover:text-indigo-400 flex items-center gap-2">
                {sub.problem || "Unknown Problem"}
                <ExternalLink className="w-4 h-4 opacity-50" />
              </a>
              <div className="flex items-center gap-4 mt-2">
                <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full border", getStatusColor(sub.status))}>
                  {sub.status || "Unknown Status"}
                </span>
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatDate(sub.timestamp)}
                </span>
              </div>
            </div>
            
            {sub.similarityScore && (
              <div className="text-xs font-mono text-violet-400 bg-violet-500/10 px-2 py-1 rounded-md border border-violet-500/20">
                Score: {sub.similarityScore.toFixed(3)}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            {(sub.topics || []).map((t, idx) => (
              <span key={idx} className="text-xs text-slate-400 bg-slate-800/50 px-2 py-1 rounded-md flex items-center gap-1">
                <Tag className="w-3 h-3" /> {t}
              </span>
            ))}
          </div>

          {(sub.mistake || sub.error) && (
            <div className="mt-4 p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg">
              {sub.mistake && <p className="text-sm text-slate-300 font-medium mb-1">AI Mentor: {sub.mistake}</p>}
              {sub.error && <p className="text-xs text-slate-500 font-mono mt-2 line-clamp-2">{sub.error}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
