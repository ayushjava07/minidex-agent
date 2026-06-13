import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";
import { ChartSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import { TrendingUp } from "lucide-react";
import { formatBytes } from "../../utils/format";

export default function StorageGrowthChart({ data, loading }) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <Card><EmptyState icon={TrendingUp} title="No storage growth data" /></Card>;

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Storage Growth</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="storageGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-surface-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => v?.slice(5, 10) || ""} />
          <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => formatBytes(v)} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} formatter={v => formatBytes(v)} />
          <Area type="monotone" dataKey="cumulativeSize" stroke="#10b981" fill="url(#storageGrad)" strokeWidth={2} activeDot={{ r: 5, fill: "#10b981" }} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
