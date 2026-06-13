import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import Card from "../ui/Card";
import { ChartSkeleton } from "../ui/Skeleton";

export default function VerificationChart({ verifiedCount = 0, failedCount = 0, loading }) {
  if (loading) return <ChartSkeleton />;
  const data = [
    { name: "Verified", value: verifiedCount, color: "#10b981" },
    { name: "Failed", value: failedCount, color: "#f43f5e" },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <Card>
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Verification Status</h3>
        <div className="flex h-48 items-center justify-center text-sm text-slate-400">No verification data</div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Verification Status</h3>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={4}>
            {data.map((entry, i) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Legend formatter={v => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
