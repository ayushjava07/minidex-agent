import { useState } from "react";
import { motion } from "framer-motion";
import { Eye, ShieldCheck, Copy, ExternalLink, ArrowUpDown } from "lucide-react";
import Card from "../ui/Card";
import Badge from "../ui/Badge";
import Pagination from "../ui/Pagination";
import { TableSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import ErrorState from "../ui/ErrorState";
import { shortCid, formatDate, formatBytes, copyToClipboard } from "../../utils/format";
import { usePagination } from "../../hooks/usePagination";
import { useFilecoinUploads } from "../../hooks/useFilecoin";
import CidDetailModal from "./CidDetailModal";

export default function LatestActivity() {
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [selectedCid, setSelectedCid] = useState(null);
  const limit = 15;

  const { data, loading, error, refetch } = useFilecoinUploads({ page, limit, sort, order });
  const pagination = usePagination({ total: data.total, initialPage: page, perPage: limit });

  const handleSort = (field) => {
    if (sort === field) { setOrder(o => o === "asc" ? "desc" : "asc") }
    else { setSort(field); setOrder("desc") }
    setPage(1);
  };

  const handlePageChange = (p) => { setPage(p); pagination.setPage(p) };

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  return (
    <>
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Latest CID Activity</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{data.total} total records</span>
        </div>

        {loading ? <TableSkeleton rows={8} /> : data.items.length === 0 ? (
          <EmptyState title="No uploads yet" description="Upload data to see CID activity here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-surface-border">
                  {["CID", "Agent", "Timestamp", "Size", "Status", "Action"].map(h => (
                    <th key={h} className="px-3 py-3 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                      {h === "Timestamp" ? (
                        <button onClick={() => handleSort("createdAt")} className="flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200">
                          {h} <ArrowUpDown className="h-3 w-3" />
                        </button>
                      ) : h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-surface-border">
                {data.items.map((item, i) => (
                  <motion.tr key={item.id || item.cid} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }} className="hover:bg-slate-50 dark:hover:bg-surface-border/50 transition-colors">
                    <td className="px-3 py-3 font-mono text-xs text-filecoin-600 dark:text-filecoin-400">{shortCid(item.cid)}</td>
                    <td className="px-3 py-3 text-slate-700 dark:text-slate-300">{item.sourceAgent || "-"}</td>
                    <td className="px-3 py-3 text-slate-500 dark:text-slate-400 text-xs">{formatDate(item.createdAt)}</td>
                    <td className="px-3 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{formatBytes(item.size)}</td>
                    <td className="px-3 py-3"><Badge variant={item.status === "success" ? "success" : "error"}>{item.status}</Badge></td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <button onClick={() => setSelectedCid(item.cid)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-filecoin-600 dark:hover:bg-surface-border" title="View"><Eye className="h-4 w-4" /></button>
                        <button onClick={() => copyToClipboard(item.cid)} className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-surface-border" title="Copy CID"><Copy className="h-4 w-4" /></button>
                        {item.verified && <ShieldCheck className="h-4 w-4 text-emerald-500" title="Verified" />}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <Pagination page={pagination.page} totalPages={pagination.totalPages} pages={pagination.pages} onPageChange={handlePageChange} />
          </div>
        )}
      </Card>

      {selectedCid && <CidDetailModal cid={selectedCid} onClose={() => setSelectedCid(null)} />}
    </>
  );
}
