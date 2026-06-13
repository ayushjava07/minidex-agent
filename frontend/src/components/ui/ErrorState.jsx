import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-rose-100 p-4 dark:bg-rose-900/30">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
      </div>
      <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Error</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary mt-4 flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      )}
    </div>
  );
}
