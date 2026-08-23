import { MessageSquare, Clock, ArrowRight, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDate } from "../utils/helpers";

export default function HistorySidebar({ 
  history, 
  onSelectHistory, 
  searchQuery, 
  setSearchQuery, 
  currentPage, 
  setCurrentPage, 
  totalPages 
}) {
  return (
    <div className="glass-panel p-4 h-full flex flex-col max-h-[calc(100vh-140px)]">
      <div className="flex items-center gap-2 mb-4 text-slate-300 px-2">
        <Clock className="w-5 h-5 text-indigo-400" />
        <h3 className="font-semibold text-sm tracking-wide uppercase">Past Conversations</h3>
      </div>
      
      <div className="relative mb-4">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search prompts..."
          className="w-full bg-slate-900 border border-slate-700/50 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
        />
      </div>
      
      {(!history || history.length === 0) ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
          <MessageSquare className="w-8 h-8 opacity-20 mb-3" />
          <p className="text-sm">No history found.</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectHistory(item)}
              className="w-full text-left p-3 rounded-lg border border-slate-700/50 bg-slate-800/20 hover:bg-slate-800/60 transition-colors group relative"
            >
              <p className="text-sm text-slate-200 font-medium line-clamp-2 pr-6">
                {item.query}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                  item.mode === "CONTEXTUAL" 
                    ? "bg-violet-500/20 text-violet-300" 
                    : "bg-cyan-500/20 text-cyan-300"
                }`}>
                  {item.mode}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatDate(item.timestamp)}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-indigo-400 absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-800">
          <button 
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-medium text-slate-500">
            Page {currentPage} of {totalPages}
          </span>
          <button 
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
