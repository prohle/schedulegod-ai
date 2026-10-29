"use client";

// Dashboard shell: two real interfaces only. The Guided wizard (step-by-step)
// and the Intelligence view (advanced) both drive the Python backend — there is
// no in-browser toy solver and no fake seed data anywhere in this tree.
import { useState } from "react";
import { Zap, Brain } from "lucide-react";
import { Toast } from "@/components/ui/toast";
import { Header } from "./header";
import { Sidebar, type ActiveView } from "./sidebar";
import { WizardView } from "./views/wizard";
import { IntelligenceView } from "./views/intelligence";

const VIEW_META: Record<ActiveView, { label: string; desc: string; icon: typeof Zap }> = {
  wizard: {
    label: "Guided Wizard",
    icon: Zap,
    desc: "Step-by-step: Import → Intake → Build → Review → Emergency",
  },
  intelligence: {
    label: "Intelligence",
    icon: Brain,
    desc: "Spectral radar · C39 audit · CP-SAT · verified tightening",
  },
};

export function Dashboard() {
  const [activeView, setActiveView] = useState<ActiveView>("wizard");
  const [toast, setToast] = useState<{
    message: string;
    type: "info" | "success" | "warning" | "error";
  } | null>(null);

  const showToast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  const meta = VIEW_META[activeView];
  const Icon = meta.icon;

  return (
    <div className="h-screen w-screen bg-background font-sans text-foreground flex flex-col overflow-hidden no-select">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeView={activeView} setActiveView={setActiveView} />
        <main className="flex-1 min-h-0 bg-muted/30 flex flex-col relative overflow-hidden">
          <div className="bg-muted/30 border-b border-border px-4 py-2 shrink-0 flex items-center gap-2 text-xs">
            <Icon className="w-4 h-4 text-primary" />
            <span className="font-bold text-foreground">{meta.label}</span>
            <span className="text-muted-foreground hidden sm:inline">{meta.desc}</span>
          </div>
          <div className="flex-1 min-h-0 bg-background p-3 overflow-y-auto custom-scrollbar">
            {activeView === "wizard" ? <WizardView onToast={showToast} /> : <IntelligenceView onToast={showToast} />}
          </div>
        </main>
      </div>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}