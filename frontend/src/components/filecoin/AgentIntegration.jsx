import { motion } from "framer-motion";
import { Activity, HardDrive, Clock, ShieldCheck, Upload } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Skeleton from "../ui/Skeleton";
import { AGENTS } from "../../utils/constants";
import { formatShortDate, shortCid } from "../../utils/format";
import { useFilecoinUploads } from "../../hooks/useFilecoin";

const HEALTH_MAP = { deploy: "active", monitor: "active", liquidity: "active", analytics: "active", report: "active" };

export default function AgentIntegration() {
  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">Agent Integration</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {AGENTS.map((agent, i) => (
          <AgentCard key={agent.id} agent={agent} index={i} />
        ))}
      </div>
    </Card>
  );
}

function AgentCard({ agent, index }) {
  const { data, loading } = useFilecoinUploads({ agent: agent.id, limit: 1, sort: "createdAt", order: "desc" });
  const health = HEALTH_MAP[agent.id] || "unknown";
  const lastItem = data.items?.[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}
      className="glass p-4 transition-all duration-300 hover:shadow-md"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: agent.color }} />
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{agent.label}</h3>
        </div>
        <Badge variant={health === "active" ? "success" : health === "degraded" ? "warning" : "error"}>{health}</Badge>
      </div>

      {loading ? (
        <div className="space-y-2"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-3/4" /></div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Upload className="h-3 w-3" /> Uploads</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{data.total}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Last Archive</span>
            <span className="font-medium text-slate-700 dark:text-slate-300">{lastItem ? formatShortDate(lastItem.createdAt) : "-"}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><HardDrive className="h-3 w-3" /> Last CID</span>
            <span className="font-mono text-filecoin-600 dark:text-filecoin-400">{lastItem ? shortCid(lastItem.cid) : "-"}</span>
          </div>
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> Verified</span>
            <Badge variant={lastItem?.verified ? "success" : "warning"}>{lastItem?.verified ? "Yes" : "N/A"}</Badge>
          </div>
        </div>
      )}
    </motion.div>
  );
}
