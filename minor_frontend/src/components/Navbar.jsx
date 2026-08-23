import { TerminalSquare, User, LogOut, Key } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, token, logout } = useAuth();

  return (
    <nav className="py-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <TerminalSquare className="w-6 h-6 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight leading-none">GraphRAG Mentor</h1>
          <p className="text-xs text-indigo-300/70 mt-1 font-medium tracking-wide uppercase">AI-Powered Analytics</p>
        </div>
      </div>

      {user && (
        <div className="flex items-center gap-4 bg-slate-900/50 border border-slate-700 rounded-full py-2 px-4 shadow-inner">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-medium text-slate-300 px-2 border-r border-slate-700 pr-4">{user}</span>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(token);
              alert("Extension Token copied to clipboard!");
            }}
            className="text-sm text-slate-400 hover:text-emerald-400 flex items-center gap-1.5 transition-colors border-r border-slate-700 pr-4"
            title="Copy API Token for Chrome Extension"
          >
            <Key className="w-4 h-4" />
            <span className="hidden sm:inline">Copy Token</span>
          </button>

          <button onClick={logout} className="text-sm text-slate-400 hover:text-rose-400 flex items-center gap-1.5 transition-colors pl-2">
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      )}
    </nav>
  );
}
