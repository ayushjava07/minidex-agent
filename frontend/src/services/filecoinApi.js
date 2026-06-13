import { API_BASE } from "../utils/constants";

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const config = {
    headers: { "content-type": "application/json", ...options.headers },
    ...options,
  };
  const res = await fetch(url, config);
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function uploadFilecoinData(data, sourceAgent = "manual", type = "manual-upload") {
  return request("/upload", {
    method: "POST",
    body: JSON.stringify({ data, sourceAgent, type }),
  });
}

export async function getCidDetails(cid) {
  return request(`/cid/${encodeURIComponent(cid)}`);
}

export async function getUploads({ page = 1, limit = 20, sort, order, agent, status, search } = {}) {
  const params = new URLSearchParams({ page, limit });
  if (sort) params.set("sort", sort);
  if (order) params.set("order", order);
  if (agent) params.set("agent", agent);
  if (status) params.set("status", status);
  if (search) params.set("search", search);
  return request(`/uploads?${params}`);
}

export async function getStats() {
  return request("/stats");
}

export async function getAnalytics({ days = 30 } = {}) {
  return request(`/analytics?days=${days}`);
}

export async function getReports({ page = 1, limit = 20 } = {}) {
  return request(`/reports?page=${page}&limit=${limit}`);
}

export async function getActivity({ limit = 50 } = {}) {
  return request(`/activity?limit=${limit}`);
}

export function createEventSource() {
  const url = `${API_BASE}/feed`;
  return new EventSource(url);
}
