import { ChevronLeft, ChevronRight } from "lucide-react";

export default function Pagination({ page, totalPages, pages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-1.5 py-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-surface-border dark:text-slate-400"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      {pages.map(p => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`min-w-[2rem] rounded-lg px-2 py-1.5 text-sm font-medium transition-colors ${p === page ? "bg-filecoin-600 text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-surface-border"}`}
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30 dark:hover:bg-surface-border dark:text-slate-400"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
