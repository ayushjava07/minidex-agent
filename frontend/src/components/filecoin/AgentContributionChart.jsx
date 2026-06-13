import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import Card from "../ui/Card";
import { ChartSkeleton } from "../ui/Skeleton";
import EmptyState from "../ui/EmptyState";
import { Users } from "lucide-react";
import { AGENTS } from "../../utils/constants";

const COLORS = AGENTS.map(a => a.color);

export default function AgentContributionChart({ data, loading }) {
  if (loading) return <ChartSkeleton />;
  if (!data || data.length === 0) return <Card><EmptyState icon={Users} title="No agent contributions" /></Card>;

  return (
    <Card>
      <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Agent Contributions</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="agent" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3}>
            {data.map((entry, i) => <Cell key={entry.agent} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
          <Legend formatter={v => <span className="text-xs text-slate-600 dark:text-slate-400">{v}</span>} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
