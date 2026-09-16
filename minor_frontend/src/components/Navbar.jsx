import { useState } from "react";
import { TerminalSquare, User, LogOut, Key, Sun, Moon, Menu, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

export default function Navbar() {
  const { user, token, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <nav className="py-4 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between relative z-50">
      <div className="flex items-center justify-between w-full sm:w-auto">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl border border-indigo-200 dark:border-indigo-500/30">
            <TerminalSquare className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">GraphRAG Mentor</h1>
            <p className="text-xs text-indigo-600/70 dark:text-indigo-300/70 mt-1 font-medium tracking-wide uppercase">AI-Powered Analytics</p>
          </div>
        </div>

        {/* Mobile menu toggle button */}
        {user && (
          <div className="flex items-center gap-1 sm:hidden">
            <button
              onClick={toggleTheme}
              className="p-2 text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button 
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        )}
      </div>

      {user && (
        <div className={`${isMenuOpen ? "flex" : "hidden"} sm:flex flex-col sm:flex-row items-start sm:items-center gap-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl sm:rounded-full py-4 sm:py-2 px-4 shadow-sm dark:shadow-lg absolute sm:relative top-[72px] sm:top-auto right-0 sm:right-auto w-full sm:w-auto transition-all`}>
          
          {/* Top row in mobile / inline on desktop */}
          <div className="flex items-center justify-between w-full sm:w-auto sm:border-r border-slate-200 dark:border-slate-700 sm:pr-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{user}</span>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="hidden sm:block text-slate-500 hover:text-indigo-500 dark:text-slate-400 dark:hover:text-amber-400 transition-colors border-r border-slate-200 dark:border-slate-700 pr-4"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          
          <button 
            onClick={() => {
              navigator.clipboard.writeText(token);
              alert("Extension Token copied to clipboard!");
            }}
            className="w-full sm:w-auto flex justify-start text-sm text-slate-500 hover:text-emerald-500 dark:text-slate-400 dark:hover:text-emerald-400 items-center gap-2 transition-colors sm:border-r border-slate-200 dark:border-slate-700 sm:pr-4 py-2 sm:py-0"
            title="Copy API Token for Chrome Extension"
          >
            <Key className="w-4 h-4" />
            <span>Copy Token</span>
          </button>

          <button 
            onClick={logout} 
            className="w-full sm:w-auto flex justify-start text-sm text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 items-center gap-2 transition-colors sm:pl-2 py-2 sm:py-0"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        </div>
      )}
    </nav>
  );
}
