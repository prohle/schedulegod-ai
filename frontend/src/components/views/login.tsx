"use client";

// Login: email/password, one-click demo accounts (seeded from the scenario),
// or register. Demo logins need no real credentials — judges can enter as
// coordinator, an instructor, or a student in one click.

import { useState } from "react";
import { GraduationCap, KeyRound, UserPlus } from "lucide-react";
import { saveSession, type AuthUser } from "@/lib/auth";

const DEMO = [
  { label: "Coordinator", email: "coordinator@schedulegod.demo", hint: "Runs the term: build, publish, approve changes" },
  { label: "Prof. Chen (instructor)", email: "chen@schedulegod.demo", hint: "Sees only her sections; requests changes" },
  { label: "CS 2025 (student)", email: "cs2025@schedulegod.demo", hint: "Sees only the cohort's courses" },
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
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 bg-gradient-to-tr from-sky-500 to-indigo-600 rounded-2xl text-white shadow-lg">
            <GraduationCap className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-extrabold">ScheduleGod AI</h1>
          <p className="text-xs text-muted-foreground">
            Sign in to your timetable. Every schedule here is solver-proven.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3 shadow-sm">
          <div className="space-y-2">
            <input
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="password"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background"
              placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {registering && (
              <div className="flex gap-2">
                <select className="border border-border rounded-lg px-2 py-2 text-sm bg-background"
                        value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="instructor">Instructor</option>
                  <option value="student">Student</option>
                  <option value="coordinator">Coordinator</option>
                </select>
                <input
                  className="flex-1 border border-border rounded-lg px-3 py-2 text-sm bg-background"
                  placeholder={role === "student" ? "Cohort id (e.g. cs2025)" : "Instructor id (e.g. chen)"}
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
            className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-50"
          >
            {registering ? <UserPlus className="w-4 h-4" /> : <KeyRound className="w-4 h-4" />}
            {registering ? "Create account" : "Sign in"}
          </button>
          <button onClick={() => setRegistering(!registering)}
                  className="w-full text-[11px] text-muted-foreground underline">
            {registering ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-2 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
            One-click demo accounts (password: demo1234)
          </p>
          {DEMO.map((d) => (
            <button key={d.email} disabled={busy}
                    onClick={() => submit("/api/auth/login", { email: d.email, password: "demo1234" })}
                    className="w-full text-left border border-border rounded-lg px-3 py-2 hover:bg-muted disabled:opacity-50">
              <span className="block text-sm font-semibold">{d.label}</span>
              <span className="block text-[11px] text-muted-foreground">{d.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
