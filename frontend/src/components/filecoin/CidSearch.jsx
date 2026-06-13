import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Loader2, FileText, AlertTriangle, Copy, ExternalLink } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { getCidDetails } from "../../services/filecoinApi";
import { formatDate, formatBytes, copyToClipboard, shortCid } from "../../utils/format";

export default function CidSearch() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    const cid = query.trim();
    if (!cid) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await getCidDetails(cid);
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">CID Search</h2>
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            className="input-field pl-9"
            placeholder="Search by CID (bafy...)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
        <button type="submit" disabled={loading || !query.trim()} className="btn-primary flex items-center gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Search
        </button>
      </form>

      {error && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </motion.div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          <DetailItem label="CID" value={result.cid}>
            <button onClick={() => copyToClipboard(result.cid)} className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-surface-border"><Copy className="h-3.5 w-3.5" /></button>
          </DetailItem>
          {result.record && (
            <>
              <DetailItem label="Data Type" value={result.record.type || "unknown"} />
              <DetailItem label="Upload Time" value={formatDate(result.record.createdAt)} />
              <DetailItem label="Agent Source" value={result.record.sourceAgent || "manual"} />
              <DetailItem label="Verification" value={result.verified !== false ? "Verified" : "Unverified"}>
                <Badge variant={result.verified !== false ? "success" : "warning"}>{result.verified !== false ? "Pass" : "Fail"}</Badge>
              </DetailItem>
              <DetailItem label="Size" value={formatBytes(result.size || result.record.size)} />
            </>
          )}
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500 dark:text-slate-400">Raw JSON Preview</p>
            <pre className="max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-700 dark:bg-surface-dark dark:text-slate-300">
              {typeof result.data === "string" ? result.data.slice(0, 1500) : JSON.stringify(result.data, null, 2).slice(0, 1500)}
            </pre>
          </div>
        </motion.div>
      )}
    </Card>
  );
}

function DetailItem({ label, value, children }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 dark:bg-surface-dark">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-sm font-mono font-medium text-slate-900 dark:text-white">{value || "-"}</span>
        {children}
      </div>
    </div>
  );
}
