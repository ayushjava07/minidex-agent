import { useState } from "react";
import { motion } from "framer-motion";
import { Upload, Loader2, CheckCircle, AlertTriangle, Copy, FileText, Database, FileBarChart, Archive } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { useFilecoinUpload } from "../../hooks/useFilecoin";
import { shortCid, copyToClipboard } from "../../utils/format";

const UPLOAD_TYPES = [
  { id: "manual-upload", label: "JSON Upload", icon: FileText, desc: "Upload arbitrary JSON data" },
  { id: "agent-report", label: "Agent Report", icon: FileBarChart, desc: "Archive agent report data" },
  { id: "analytics", label: "Analytics Upload", icon: Database, desc: "Upload analytics snapshots" },
  { id: "manual-archive", label: "Manual Archive", icon: Archive, desc: "Manual data archive" },
];

export default function UploadCenter() {
  const [data, setData] = useState("");
  const [type, setType] = useState("manual-upload");
  const [jsonError, setJsonError] = useState(null);
  const { upload, uploading, result, error, reset } = useFilecoinUpload();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setJsonError(null);
    reset();
    if (!data.trim()) return;
    let payload;
    try { payload = JSON.parse(data); } catch { payload = data; }
    try {
      await upload(payload, "manual", type);
    } catch {}
  };

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Upload Center</h2>

      <div className="mb-4 flex flex-wrap gap-2">
        {UPLOAD_TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => setType(t.id)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${type === t.id ? "border-filecoin-500 bg-filecoin-50 text-filecoin-700 dark:bg-filecoin-950/40 dark:text-filecoin-300" : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-surface-border dark:text-slate-400"}`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          className="input-field min-h-[120px] font-mono text-xs"
          placeholder='Paste JSON or text data to upload…'
          value={data}
          onChange={e => setData(e.target.value)}
        />
        <button type="submit" disabled={uploading || !data.trim()} className="btn-primary flex w-full items-center justify-center gap-2">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading to Filecoin…" : "Upload to Filecoin"}
        </button>
      </form>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-900/20 dark:text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </motion.div>
      )}

      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3 rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
            <CheckCircle className="h-5 w-5" />
            <span className="text-sm font-semibold">Upload Complete</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">CID</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-filecoin-600 dark:text-filecoin-400">{shortCid(result.cid)}</span>
                <button onClick={() => copyToClipboard(result.cid)} className="rounded p-1 text-slate-400 hover:bg-slate-200 dark:hover:bg-surface-border"><Copy className="h-3.5 w-3.5" /></button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-400">Status</span>
              <Badge variant={result.verified ? "success" : "warning"}>{result.verified ? "Verified" : "Pending"}</Badge>
            </div>
          </div>
        </motion.div>
      )}
    </Card>
  );
}
