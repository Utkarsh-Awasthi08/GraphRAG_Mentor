import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getStatusColor(status) {
  const s = (status || "").toLowerCase();
  if (s.includes("accepted")) return "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
  if (s.includes("compile")) return "text-rose-400 bg-rose-400/10 border-rose-400/20";
  if (s.includes("wrong answer")) return "text-orange-400 bg-orange-400/10 border-orange-400/20";
  return "text-amber-400 bg-amber-400/10 border-amber-400/20";
}

export function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
