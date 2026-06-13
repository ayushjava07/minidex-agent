import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";
import { ChartSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import { BarChart3 } from "lucide-react";

export default function UploadActivityChart({ data, loading }) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <Card><EmptyState icon={BarChart3} title="No upload activity" description="Upload data to see daily activity." /></Card>;

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Upload Activity</h3>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" className="dark:stroke-surface-border" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#94a3b8" }} tickFormatter={v => v?.slice(5) || ""} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} labelFormatter={v => `Date: ${v}`} />
          <Area type="monotone" dataKey="count" stroke="#6366f1" fill="url(#uploadGrad)" strokeWidth={2} activeDot={{ r: 5, fill: "#6366f1" }} />
        </AreaChart>
      </ResponsiveContainer>
    </Card>
  );
}
