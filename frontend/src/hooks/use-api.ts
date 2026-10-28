"use client";

import { useState, useEffect, useCallback } from "react";
import type { Scenario, SolveResult, CopilotResponse, Operation } from "@/types";

const API_BASE = "";

export function useScenario() {
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchScenario = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/scenario`);
      if (!res.ok) throw new Error("Failed to load scenario");
      const data = await res.json();
      setScenario(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load scenario");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScenario();
  }, [fetchScenario]);

  return { scenario, loading, error, refetch: fetchScenario };
}

export function useCopilot() {
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const send = useCallback(async (message: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/copilot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const sendEmergency = useCallback(async (message: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/emergency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setResponse(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { response, loading, send, sendEmergency };
}

export function useSolve() {
  const [result, setResult] = useState<SolveResult | null>(null);
  const [loading, setLoading] = useState(false);

  const solve = useCallback(async (operations?: Operation[]) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/solve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operations: operations || [] }),
      });
      const data = await res.json();
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { result, loading, solve };
}

export function useParse() {
  const [parsed, setParsed] = useState<CopilotResponse["operations"] | null>(null);
  const [loading, setLoading] = useState(false);

  const parse = useCallback(async (message: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      setParsed(data.operations);
      return data;
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  return { parsed, loading, parse };
}