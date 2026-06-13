import { motion } from "framer-motion";
import { Database, HardDrive, Upload, ShieldCheck, Activity } from "lucide-react";
import { formatBytes } from "../../utils/format";
import { StatSkeleton } from "../ui/Skeleton";

const statConfig = [
  { key: "totalUploads", label: "Total Records Stored", icon: Database, color: "from-filecoin-500 to-blue-600", suffix: "" },
  { key: "totalSize", label: "Total Storage Used", icon: HardDrive, color: "from-purple-500 to-pink-600", suffix: "", format: formatBytes },
  { key: "totalUploads_dedup", label: "Total Uploads", icon: Upload, color: "from-cyan-500 to-teal-600", suffix: "" },
  { key: "verified", label: "Verified Records", icon: ShieldCheck, color: "from-emerald-500 to-green-600", suffix: "" },
  { key: "retrievalSuccessRate", label: "Retrieval Success Rate", icon: Activity, color: "from-amber-500 to-orange-600", suffix: "%" },
];

export default function HeroStats({ stats, loading }) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => <StatSkeleton key={i} />)}
      </div>
    );
  }
  if (!stats) return null;

  const items = statConfig.map(cfg => {
    let value;
    if (cfg.key === "totalUploads_dedup") {
      value = stats.totalUploads || 0;
    } else {
      value = stats[cfg.key];
    }
    if (cfg.format) value = cfg.format(value);
    return { ...cfg, value };
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((item, i) => (
        <motion.div
          key={item.key}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.08, duration: 0.4 }}
          className="stat-card group cursor-default"
        >
          <div className="flex items-start justify-between">
            <div className={`rounded-xl bg-gradient-to-br ${item.color} p-2.5 text-white shadow-lg transition-transform group-hover:scale-110`}>
              <item.icon className="h-5 w-5" />
            </div>
          </div>
          <p className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{item.value ?? "-"}</p>
          <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{item.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
