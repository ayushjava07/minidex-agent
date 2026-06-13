import { useEffect, useRef, useState } from "react";
import { createEventSource } from "../services/filecoinApi";

export function useSSE() {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);
  const maxEvents = 100;

  useEffect(() => {
    let es;
    try {
      es = createEventSource();
      esRef.current = es;

      es.onopen = () => setConnected(true);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === "connected") return;
          setEvents(prev => [data, ...prev].slice(0, maxEvents));
        } catch {}
      };
      es.onerror = () => {
        setConnected(false);
        es.close();
        setTimeout(() => {
          try {
            const newEs = createEventSource();
            esRef.current = newEs;
          } catch {}
        }, 3000);
      };
    } catch {
      setConnected(false);
    }

    return () => {
      if (es) es.close();
    };
  }, []);

  return { events, connected };
}
