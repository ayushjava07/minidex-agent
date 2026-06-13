import { useCallback, useEffect, useState } from "react";
import * as api from "../services/filecoinApi";

export function useFilecoinStats() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getStats();
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch() }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useFilecoinAnalytics({ days = 30 } = {}) {
  const [data, setData] = useState({ uploadActivity: [], agentContributions: [], storageGrowth: [], verificationRate: 100 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getAnalytics({ days });
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { fetch() }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useFilecoinUploads({ page = 1, limit = 20, sort, order, agent, status, search } = {}) {
  const [data, setData] = useState({ items: [], total: 0, page: 1, totalPages: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getUploads({ page, limit, sort, order, agent, status, search });
      setData(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, order, agent, status, search]);

  useEffect(() => { fetch() }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useFilecoinActivity() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getActivity().then(res => { setEvents(res.events || []); setLoading(false) }).catch(() => setLoading(false));
  }, []);

  return { events, loading };
}

export function useFilecoinUpload() {
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const upload = useCallback(async (data, sourceAgent, type) => {
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const res = await api.uploadFilecoinData(data, sourceAgent, type);
      setResult(res);
      return res;
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setUploading(false);
    }
  }, []);

  return { upload, uploading, result, error, reset: () => { setResult(null); setError(null) } };
}
