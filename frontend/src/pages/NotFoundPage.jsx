import { Link } from "react-router-dom";
import { Home } from "lucide-react";

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="text-7xl font-bold text-filecoin-200 dark:text-filecoin-900">404</div>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">Page Not Found</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">The page you are looking for does not exist.</p>
      <Link to="/" className="btn-primary mt-6 flex items-center gap-2">
        <Home className="h-4 w-4" /> Back to Dashboard
      </Link>
    </div>
  );
}
