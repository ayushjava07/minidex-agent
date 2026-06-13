import { motion, AnimatePresence } from "framer-motion";
import { Wifi, WifiOff, Upload, ShieldCheck, AlertTriangle, Archive } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import { useSSE } from "../../hooks/useSSE";
import { useFilecoinActivity } from "../../hooks/useFilecoin";
import { formatShortDate, shortCid } from "../../utils/format";

const EVENT_ICONS = { upload: Upload, verify: ShieldCheck, archive: Archive, error: AlertTriangle };

export default function RealTimeFeed() {
  const { events: sseEvents, connected } = useSSE();
  const { events: history } = useFilecoinActivity();

  const allEvents = sseEvents.length > 0 ? sseEvents : history.slice(0, 50);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Real-Time Filecoin Feed</h2>
          <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${connected ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-surface-border dark:text-slate-400"}`}>
            {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {connected ? "Live" : "Offline"}
          </div>
        </div>
      </div>

      {allEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Wifi className="mb-3 h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="text-sm text-slate-500 dark:text-slate-400">No live events yet. Upload data or wait for agent activity.</p>
        </div>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {allEvents.map((event, i) => {
              const Icon = EVENT_ICONS[event.type] || Upload;
              return (
                <motion.div
                  key={event.id || i}
                  initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs transition-colors hover:bg-slate-50 dark:hover:bg-surface-border/50"
                >
                  <div className={`rounded-full p-1.5 ${event.type === "error" ? "bg-rose-100 text-rose-600 dark:bg-rose-900/30" : event.type === "verify" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30" : "bg-filecoin-100 text-filecoin-600 dark:bg-filecoin-900/30"}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-700 dark:text-slate-300">{event.type === "upload" ? "Upload" : event.type === "verify" ? "Verified" : event.type === "archive" ? "Archived" : event.type}</span>
                    {event.cid && <span className="ml-2 font-mono text-filecoin-600 dark:text-filecoin-400">{shortCid(event.cid)}</span>}
                    {event.agent && <span className="ml-2 text-slate-500 dark:text-slate-400">by {event.agent}</span>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {event.status && <Badge variant={event.status === "success" ? "success" : "error"}>{event.status}</Badge>}
                    <span className="text-slate-400 dark:text-slate-500">{formatShortDate(event.timestamp)}</span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
