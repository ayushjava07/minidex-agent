export const API_BASE = "/api/filecoin";

export const AGENTS = [
  { id: "deploy", label: "Deploy Agent", color: "#6366f1" },
  { id: "monitor", label: "Monitor Agent", color: "#8b5cf6" },
  { id: "liquidity", label: "Liquidity Agent", color: "#06b6d4" },
  { id: "analytics", label: "Analytics Agent", color: "#10b981" },
  { id: "report", label: "Report Agent", color: "#f59e0b" },
];

export const STATUS_COLORS = {
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  failed: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  uploading: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  pending: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  verified: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  unverified: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};
