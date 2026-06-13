import { useFilecoinStats, useFilecoinAnalytics } from "../hooks/useFilecoin";
import HeroStats from "../components/filecoin/HeroStats";
import UploadActivityChart from "../components/filecoin/UploadActivityChart";
import StorageGrowthChart from "../components/filecoin/StorageGrowthChart";
import AgentContributionChart from "../components/filecoin/AgentContributionChart";
import VerificationChart from "../components/filecoin/VerificationChart";
import LatestActivity from "../components/filecoin/LatestActivity";
import CidSearch from "../components/filecoin/CidSearch";
import UploadCenter from "../components/filecoin/UploadCenter";
import AgentIntegration from "../components/filecoin/AgentIntegration";
import RealTimeFeed from "../components/filecoin/RealTimeFeed";

export default function FilecoinPage() {
  const { data: stats, loading: statsLoading, refetch: refetchStats } = useFilecoinStats();
  const { data: analytics, loading: analyticsLoading } = useFilecoinAnalytics({ days: 30 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Filecoin Storage</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Decentralized IPLD archival and monitoring dashboard</p>
      </div>

      <HeroStats stats={stats} loading={statsLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <UploadActivityChart data={analytics.uploadActivity} loading={analyticsLoading} />
        <StorageGrowthChart data={analytics.storageGrowth} loading={analyticsLoading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <AgentContributionChart data={analytics.agentContributions} loading={analyticsLoading} />
        </div>
        <VerificationChart verifiedCount={analytics.verifiedCount} failedCount={analytics.failedCount} loading={analyticsLoading} />
      </div>

      <LatestActivity />

      <div className="grid gap-6 lg:grid-cols-2">
        <CidSearch />
        <UploadCenter />
      </div>

      <AgentIntegration />

      <RealTimeFeed />
    </div>
  );
}
