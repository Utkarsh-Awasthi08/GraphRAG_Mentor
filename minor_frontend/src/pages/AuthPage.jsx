import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { TerminalSquare, Lock, User, Sparkles } from "lucide-react";

export default function AuthPage() {
  const { login, register } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setLoading(true);
    try {
      if (isForgotPassword) {
        const res = await fetch("http://localhost:3000/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, newPassword: password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reset failed");
        setSuccessMessage("Password reset successfully. You can now sign in.");
        setTimeout(() => {
          setIsForgotPassword(false);
          setIsLogin(true);
          setPassword("");
          setSuccessMessage("");
        }, 2000);
      } else if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/20 via-slate-950 to-slate-950">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
          <TerminalSquare className="w-8 h-8 text-indigo-400" />
        </div>
        <h1 className="text-3xl font-bold text-white tracking-tight">GraphRAG Mentor</h1>
      </div>

      <div className="glass-panel w-full max-w-md p-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl" />
        
        <div className="relative z-10">
          <h2 className="text-2xl font-semibold text-white mb-2">
            {isForgotPassword ? "Reset Password" : isLogin ? "Welcome back" : "Create an account"}
          </h2>
          <p className="text-slate-400 text-sm mb-8">
            {isForgotPassword 
              ? "Enter your username and new password to reset it"
              : isLogin 
                ? "Enter your credentials to access your dashboard" 
                : "Sign up to track your coding journey securely"}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">Username</label>
              <div className="relative">
                <User className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="Leetcode Username"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 uppercase tracking-wider mb-2">
                {isForgotPassword ? "New Password" : "Password"}
              </label>
              <div className="relative">
                <Lock className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/50 border border-slate-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
                {error}
              </div>
            )}
            {successMessage && (
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                {successMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2 mt-6"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isForgotPassword ? (
                "Reset Password"
              ) : isLogin ? (
                "Sign In"
              ) : (
                <>Sign Up <Sparkles className="w-4 h-4" /></>
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3">
            {!isForgotPassword && isLogin && (
              <button
                onClick={() => {
                  setIsForgotPassword(true);
                  setError("");
                }}
                className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                Forgot Password?
              </button>
            )}
            
            {isForgotPassword ? (
              <button
                onClick={() => {
                  setIsForgotPassword(false);
                  setIsLogin(true);
                  setError("");
                }}
                className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                Back to Sign In
              </button>
            ) : (
              <button
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                }}
                className="text-sm text-slate-400 hover:text-indigo-400 transition-colors"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
