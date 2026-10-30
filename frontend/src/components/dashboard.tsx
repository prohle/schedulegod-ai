"use client";

// Dashboard shell: login gate + role-aware interfaces. The Guided wizard
// (coordinator), Intelligence view, and My Schedule (per-role published
// timetable) all drive the Python backend — no in-browser solver, no fake
// data anywhere in this tree.

import { useEffect, useState } from "react";
import { Zap, Brain, CalendarDays } from "lucide-react";
import { Toast } from "@/components/ui/toast";
import { Header } from "./header";
import { Sidebar, type ActiveView } from "./sidebar";
import { WizardView } from "./views/wizard";
import { IntelligenceView } from "./views/intelligence";
import { LoginView } from "./views/login";
import { MyScheduleView } from "./views/my-schedule";
import { authFetch, clearSession, getStoredUser, type AuthUser } from "@/lib/auth";

const VIEW_META: Record<ActiveView, { label: string; desc: string; icon: typeof Zap }> = {
  wizard: {
    label: "Guided Wizard",
    icon: Zap,
    desc: "Step-by-step: Import → Intake → Build → Review → Emergency",
  },
  schedule: {
    label: "My Schedule",
    icon: CalendarDays,
    desc: "Published timetable for your role · change requests",
  },
  intelligence: {
    label: "Intelligence",
    icon: Brain,
    desc: "Spectral radar · C39 audit · CP-SAT · verified tightening",
  },
};

export function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("wizard");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  useEffect(() => {
    const stored = getStoredUser();
    if (!stored) { setAuthReady(true); return; }
    authFetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const me = (await res.json()).user as AuthUser;
          setUser(me);
          setActiveView(me.role === "coordinator" ? "wizard" : "schedule");
        } else {
          clearSession();
        }
      })
      .catch(() => {})
      .finally(() => setAuthReady(true));
  }, []);

  function handleLogin(next: AuthUser) {
    setUser(next);
    setActiveView(next.role === "coordinator" ? "wizard" : "schedule");
  }

  async function handleLogout() {
    try { await authFetch("/api/auth/logout", { method: "POST" }); } catch { /* local clear still applies */ }
    clearSession();
    setUser(null);
    showToast("Signed out", "info");
  }

  if (!authReady) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">Loading…</div>;
  }
  if (!user) {
    return (
      <>
        <LoginView onLogin={handleLogin} onToast={showToast} />
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </>
    );
  }

  const meta = VIEW_META[activeView];
  const Icon = meta.icon;

  return (
    <div className="h-screen w-screen bg-background font-sans text-foreground flex flex-col overflow-hidden no-select">
      <Header user={user} onLogout={handleLogout} />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
        <main className="flex-1 min-h-0 bg-muted/30 flex flex-col relative overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-4 py-2 shrink-0 flex items-center gap-2 text-xs">
            <Icon className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground">{meta.label}</span>
            <span className="text-muted-foreground hidden sm:inline">{meta.desc}</span>
          </div>
          <div className="flex-1 min-h-0 bg-background p-3 overflow-y-auto custom-scrollbar">
            {activeView === "wizard" && <WizardView onToast={showToast} />}
            {activeView === "schedule" && <MyScheduleView user={user} onToast={showToast} />}
            {activeView === "intelligence" && <IntelligenceView onToast={showToast} />}
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
