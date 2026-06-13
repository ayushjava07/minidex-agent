import { useCallback, useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";

const API_BASE = "/api/v1/filecoin";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json", ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function FilecoinDashboard() {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [storeInput, setStoreInput] = useState("");
  const [retrieveCid, setRetrieveCid] = useState("");
  const [verifyCid, setVerifyCid] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState("");

  const fetchStatus = useCallback(async () => {
    try {
      const [s, st] = await Promise.all([
        apiFetch("/status"),
        apiFetch("/stats"),
      ]);
      setStatus(s);
      setStats(st);
    } catch {
      setStatus({ error: "Backend unavailable" });
    }
  }, []);

  const fetchHealth = useCallback(async () => {
    try {
      const h = await apiFetch("/health");
      setStatus((prev) => ({ ...prev, health: h }));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const timer = setInterval(fetchHealth, 15000);
    return () => clearInterval(timer);
  }, [fetchStatus, fetchHealth]);

  async function handleStore() {
    if (!storeInput.trim()) return;
    setLoading("store");
    setResult(null);
    try {
      let data;
      try {
        data = JSON.parse(storeInput);
      } catch {
        data = storeInput;
      }
      const res = await apiFetch("/store", {
        method: "POST",
        body: JSON.stringify(data),
      });
      setResult({ type: "store", data: res });
      toast.success("Data stored on Filecoin");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading("");
    }
  }

  async function handleRetrieve() {
    if (!retrieveCid.trim()) return;
    setLoading("retrieve");
    setResult(null);
    try {
      const res = await apiFetch(`/retrieve/${encodeURIComponent(retrieveCid.trim())}`, {
        method: "POST",
      });
      setResult({ type: "retrieve", data: res });
      toast.success("Data retrieved from Filecoin");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading("");
    }
  }

  async function handleVerify() {
    if (!verifyCid.trim()) return;
    setLoading("verify");
    setResult(null);
    try {
      const res = await apiFetch(`/verify/${encodeURIComponent(verifyCid.trim())}`, {
        method: "POST",
        body: "{}",
      });
      setResult({ type: "verify", data: res });
      toast.success(res.valid ? "Integrity verified" : "Integrity check failed");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Toaster position="top-right" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Filecoin Storage</h1>
              <p className="text-sm font-medium text-slate-500">Decentralized persistent IPLD backup layer</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-bold ${
              status?.storacha?.enabled ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
            }`}>
              {status?.storacha?.enabled ? "Storacha Connected" : "Storacha Disabled"}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Backend Status</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Storacha</span>
                <span className={`font-bold ${status?.storacha?.enabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {status?.storacha?.enabled ? "Online" : "Offline"}
                </span>
              </div>
              {status?.storacha?.space && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Space</span>
                  <span className="font-mono text-xs text-slate-500">{status.storacha.space}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Lotus / Filecoin</span>
                <span className={`font-bold ${status?.lotus?.enabled ? "text-emerald-600" : "text-slate-400"}`}>
                  {status?.lotus?.enabled ? "Online" : "Offline"}
                </span>
              </div>
              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Uploads Cached</span>
                  <span className="font-mono font-bold text-indigo-600">{stats?.uploadCacheSize ?? "-"}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-600">Retrievals Cached</span>
                  <span className="font-mono font-bold text-indigo-600">{stats?.retrieveCacheSize ?? "-"}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Store Data</h2>
            <div className="space-y-3">
              <textarea
                className="w-full rounded-lg border border-slate-300 bg-white p-3 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                rows={4}
                placeholder='Paste JSON or text data to store on Filecoin…'
                value={storeInput}
                onChange={(e) => setStoreInput(e.target.value)}
              />
              <button
                disabled={loading === "store" || !storeInput.trim()}
                onClick={handleStore}
                className="w-full rounded-lg bg-indigo-600 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "store" ? "Storing…" : "Store on Filecoin"}
              </button>
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Retrieve Data</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-mono focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                placeholder="Enter CID to retrieve…"
                value={retrieveCid}
                onChange={(e) => setRetrieveCid(e.target.value)}
              />
              <button
                disabled={loading === "retrieve" || !retrieveCid.trim()}
                onClick={handleRetrieve}
                className="w-full rounded-lg bg-purple-600 py-2.5 font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "retrieve" ? "Retrieving…" : "Retrieve"}
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Verify Integrity</h2>
            <div className="space-y-3">
              <input
                className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm font-mono focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                placeholder="Enter CID to verify…"
                value={verifyCid}
                onChange={(e) => setVerifyCid(e.target.value)}
              />
              <button
                disabled={loading === "verify" || !verifyCid.trim()}
                onClick={handleVerify}
                className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading === "verify" ? "Verifying…" : "Verify Integrity"}
              </button>
            </div>
          </section>
        </div>

        {result && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">
              {result.type === "store" ? "Store Result" : result.type === "retrieve" ? "Retrieve Result" : "Verify Result"}
            </h2>
            <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-4 text-xs font-mono text-slate-700">
              {JSON.stringify(result.data, null, 2)}
            </pre>
          </section>
        )}

        {status?.health && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-slate-900">Health</h2>
            <div className="flex items-center gap-2 text-sm">
              <span className={`h-2.5 w-2.5 rounded-full ${status.health.status === "ok" ? "bg-emerald-500" : "bg-rose-500"}`} />
              <span className="font-medium text-slate-700">{status.health.status.toUpperCase()}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{new Date(status.health.timestamp).toLocaleString()}</span>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
