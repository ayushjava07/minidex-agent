import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Copy, ShieldCheck, AlertTriangle, FileText, Clock, HardDrive, User, ExternalLink } from "lucide-react";
import Badge from "../ui/Badge";
import Skeleton from "../ui/Skeleton";
import { getCidDetails } from "../../services/filecoinApi";
import { formatDate, formatBytes, copyToClipboard, shortCid } from "../../utils/format";

export default function CidDetailModal({ cid, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    setError(null);
    getCidDetails(cid).then(res => { setData(res); setLoading(false) }).catch(e => { setError(e.message); setLoading(false) });
  }, [cid]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-12 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 30, scale: 0.96 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="glass-dark relative mx-4 w-full max-w-2xl max-h-[85vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white/95 p-5 backdrop-blur dark:border-surface-border dark:bg-surface-card/95">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-filecoin-600" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">CID Details</h2>
            </div>
            <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-surface-border">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-5 space-y-5">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center py-8 text-center">
                <AlertTriangle className="mb-3 h-10 w-10 text-rose-400" />
                <p className="text-sm text-slate-600 dark:text-slate-400">{error}</p>
              </div>
            ) : data ? (
              <>
                <DetailRow icon={FileText} label="CID" value={data.cid} copyable />

                {data.record && (
                  <>
                    <DetailRow icon={Clock} label="Upload Time" value={formatDate(data.record.createdAt)} />
                    <DetailRow icon={User} label="Source Agent" value={data.record.sourceAgent || "manual"} />
                    <DetailRow icon={HardDrive} label="Size" value={formatBytes(data.size || data.record.size)} />
                    <DetailRow icon={ShieldCheck} label="Verified" value={data.verified !== false ? "Yes" : "No"} valueColor={data.verified !== false ? "text-emerald-600" : "text-rose-600"} />
                    <DetailRow icon={ShieldCheck} label="Status" value={data.record.status || "unknown"} />
                  </>
                )}

                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">Stored Data Preview</h4>
                  <pre className="max-h-48 overflow-auto rounded-lg bg-slate-50 p-3 text-xs font-mono text-slate-700 dark:bg-surface-dark dark:text-slate-300">
                    {typeof data.data === "string" ? data.data.slice(0, 2000) : JSON.stringify(data.data, null, 2).slice(0, 2000)}
                    {(typeof data.data === "string" ? data.data.length : JSON.stringify(data.data).length) > 2000 ? "\n\n... (truncated)" : ""}
                  </pre>
                </div>
              </>
            ) : null}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function DetailRow({ icon: Icon, label, value, copyable, valueColor }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-surface-dark">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-slate-400" />
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-mono font-medium text-slate-900 dark:text-white ${valueColor || ""}`}>
          {copyable ? shortCid(value) : value || "-"}
        </span>
        {copyable && (
          <button onClick={() => copyToClipboard(value)} className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-surface-border">
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
