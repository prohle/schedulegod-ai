"use client";

// Login: email/password, one-click demo accounts (seeded from the scenario),
// or register. Demo logins need no real credentials — judges can enter as
// coordinator, an instructor, or a student in one click.

import { useState } from "react";
import { GraduationCap, KeyRound, UserPlus } from "lucide-react";
import { saveSession, type AuthUser } from "@/lib/auth";

const DEMO = [
  { label: "Coordinator", email: "coordinator@schedulesolve.demo", hint: "Runs the term: build, publish, approve changes" },
  { label: "Prof. Chen (instructor)", email: "chen@schedulesolve.demo", hint: "Sees only her sections; requests changes" },
  { label: "CS 2025 (student)", email: "cs2025@schedulesolve.demo", hint: "Sees only the cohort's courses" },
];

export function LoginView({ onLogin, onToast }: {
  onLogin: (user: AuthUser) => void;
  onToast: (message: string, type?: "info" | "success" | "warning" | "error") => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [role, setRole] = useState("instructor");
  const [linkId, setLinkId] = useState("");

  async function submit(path: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || data.error || "Login failed");
      saveSession(data.token, data.user);
      onToast(`Welcome, ${data.user.display_name}`, "success");
      onLogin(data.user as AuthUser);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Login failed", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-background p-4">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_50%_-10%,rgba(99,102,241,0.16),transparent),radial-gradient(40rem_24rem_at_90%_110%,rgba(14,165,233,0.12),transparent)]" />
      <div className="animate-rise relative w-full max-w-md space-y-4">
        <div className="space-y-2 text-center">
          <div className="inline-flex rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 p-3 text-white shadow-lg shadow-indigo-500/25">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight">ScheduleSolve AI</h1>
          <p className="text-xs text-muted-foreground" title="Every schedule here is solver-proven — the AI proposes, the solver verifies.">
            Solver-proven timetables
          </p>
        </div>

        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-xl shadow-slate-900/5">
          <div className="space-y-2">
            <input
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="Email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm"
              placeholder="Password" autoComplete={registering ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {registering && (
              <div className="flex gap-2">
                <select className="min-h-11 rounded-xl border border-border bg-background px-2 py-2 text-sm"
                        value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="instructor">Instructor</option>
                  <option value="student">Student</option>
                  <option value="coordinator">Coordinator</option>
                </select>
                <input
                  className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm"
                  placeholder={role === "student" ? "Cohort id (cs2025)" : "Instructor id (chen)"}
                  value={linkId} onChange={(e) => setLinkId(e.target.value)}
                />
              </div>
            )}
          </div>
          <button
            disabled={busy || !email || !password}
            onClick={() => registering
              ? submit("/api/auth/register", {
                  email, password, role,
                  instructor_id: role === "instructor" ? linkId || undefined : undefined,
                  cohort_id: role === "student" ? linkId || undefined : undefined,
                })
              : submit("/api/auth/login", { email, password })}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/25 transition-all active:scale-[0.99] disabled:opacity-50"
          >
            {registering ? <UserPlus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            {registering ? "Create account" : "Sign in"}
          </button>
          <button onClick={() => setRegistering(!registering)}
                  className="min-h-9 w-full text-[11px] text-muted-foreground underline underline-offset-2">
            {registering ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>

        <div className="space-y-2 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
            Demo — one tap, no password
          </p>
          {DEMO.map((d) => (
            <button key={d.email} disabled={busy} title={d.hint}
                    onClick={() => submit("/api/auth/login", { email: d.email, password: "demo1234" })}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-border px-3 py-2 text-left transition-all hover:border-primary/40 hover:bg-accent active:scale-[0.99] disabled:opacity-50">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{d.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">{d.hint}</span>
              </span>
              <span className="shrink-0 text-muted-foreground">→</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
