"use client";

// My Schedule: the published timetable filtered to the signed-in user.
// - instructor: own sections + a change-request box (coordinator decides;
//   applying runs the verified co-pilot loop and re-publishes)
// - student: the cohort's courses this term, read-only
// - coordinator: full timetable, Publish button, change-request queue

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Send, X } from "lucide-react";
import { authFetch, type AuthUser } from "@/lib/auth";
import { TimetableGrid } from "@/components/timetable-grid";
import { InfoTip } from "@/components/ui/tip";
import type { Placement } from "@/types";

interface MineResponse {
  role: string;
  scope: string;
  status: string;
  objective: number | null;
  placements: Placement[];
}

interface ChangeRequest {
  id: number;
  instructor_id?: string | null;
  requester?: string;
  message: string;
  status: string;
  result_summary?: string | null;
  created_at?: string | null;
}

export function MyScheduleView({ user, onToast }: {
  user: AuthUser;
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}) {
  const [mine, setMine] = useState<MineResponse | null>(null);
  const [unpublished, setUnpublished] = useState(false);
  const [message, setMessage] = useState("");
  const [requests, setRequests] = useState<ChangeRequest[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch("/api/schedule/mine");
    if (res.status === 404) { setUnpublished(true); setMine(null); }
    else if (res.ok) { setMine(await res.json()); setUnpublished(false); }
    const listPath = user.role === "coordinator"
      ? "/api/change-requests" : "/api/me/change-requests";
    const list = await authFetch(listPath);
    if (list.ok) setRequests((await list.json()).requests ?? []);
  }, [user.role]);

  useEffect(() => { load().catch(() => {}); }, [load]);

  async function publish() {
    setBusy(true);
    try {
      const res = await authFetch("/api/schedule/publish", {
        method: "POST", body: JSON.stringify({ engine: "cpsat" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Publish failed");
      onToast(`Published schedule #${data.id}: ${data.status}, penalty ${data.objective}`, "success");
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Publish failed", "error");
    } finally { setBusy(false); }
  }

  async function sendRequest() {
    if (!message.trim()) return;
    setBusy(true);
    try {
      const res = await authFetch("/api/me/change-requests", {
        method: "POST", body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "Request failed");
      setMessage("");
      onToast("Change request sent to the coordinator", "success");
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Request failed", "error");
    } finally { setBusy(false); }
  }

  async function decide(id: number, action: "apply" | "reject") {
    setBusy(true);
    try {
      const res = await authFetch(`/api/change-requests/${id}/decide`, {
        method: "POST", body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Decision failed");
      onToast(`Request #${id}: ${data.status}`, data.status === "applied" ? "success" : "warning");
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Decision failed", "error");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto w-full space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight">
              <CalendarDays className="w-4 h-4 text-primary" />
              {user.role === "student" ? "My Cohort Timetable"
                : user.role === "instructor" ? "My Teaching Schedule"
                : "Published Timetable"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {mine ? `${mine.scope} · ${mine.status} · penalty ${mine.objective}` : "Nothing published yet"}
            </p>
          </div>
          <InfoTip text="The coordinator builds the term in Express, then publishes it here. You only see your own sections (instructor) or your cohort's courses (student)." />
        </div>
        {user.role === "coordinator" && (
          <button disabled={busy} onClick={publish}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> Publish
          </button>
        )}
      </div>

      {unpublished && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          No schedule published yet.
          {user.role === "coordinator" ? " Build it in Express, then publish here." : " Ask your coordinator to publish it."}
        </div>
      )}

      {mine && mine.placements.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-2.5 shadow-sm sm:p-3">
          <TimetableGrid placements={mine.placements} />
        </div>
      )}
      {mine && mine.placements.length === 0 && (
        <div className="rounded-2xl border border-border bg-card p-4 text-sm shadow-sm">
          Nothing assigned to you in the published schedule yet.
        </div>
      )}

      {(user.role === "instructor") && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center gap-1.5">
            <h3 className="text-xs font-bold tracking-wide uppercase">Request a change</h3>
            <InfoTip text="Plain language, like you'd email it. The coordinator reviews it; applying re-runs the verified solver and re-publishes — your grid updates only if the change is proven feasible." />
          </div>
          <textarea
            className="min-h-20 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
            placeholder='e.g. "I can&apos;t teach Fridays."'
            value={message} onChange={(e) => setMessage(e.target.value)}
          />
          <button disabled={busy || !message.trim()} onClick={sendRequest}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all active:scale-[0.98] disabled:opacity-50">
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </div>
      )}

      {requests.length > 0 && (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <h3 className="text-xs font-bold uppercase tracking-wide">
            {user.role === "coordinator" ? "Change requests" : "My change requests"}
          </h3>
          {requests.map((r) => (
            <div key={r.id} className="border border-border rounded-lg px-3 py-2 flex items-start justify-between gap-3">
              <div className="text-xs space-y-0.5">
                <p className="font-semibold">
                  #{r.id} · {r.requester || r.instructor_id || "instructor"}
                  <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    r.status === "applied" ? "bg-emerald-100 text-emerald-800"
                    : r.status === "rejected" ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"}`}>{r.status}</span>
                </p>
                <p>{r.message}</p>
                {r.result_summary && (
                  <p className="text-muted-foreground">{r.result_summary}</p>
                )}
              </div>
              {user.role === "coordinator" && r.status === "pending" && (
                <div className="flex gap-1 shrink-0">
                  <button disabled={busy} onClick={() => decide(r.id, "apply")}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-semibold text-white transition-all active:scale-[0.97] disabled:opacity-50">
                    <Check className="w-3 h-3" /> Apply (verified)
                  </button>
                  <button disabled={busy} onClick={() => decide(r.id, "reject")}
                          className="inline-flex min-h-9 items-center gap-1 rounded-lg bg-muted px-2.5 py-1.5 text-[11px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50">
                    <X className="w-3 h-3" /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
