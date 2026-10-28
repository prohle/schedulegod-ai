"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Sparkles, RotateCcw, X, Send, Mic, Loader2, CheckCircle2, XCircle, AlertCircle, Brain, ShieldCheck, User, Users, Building, RotateCcw as RotateCcwIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import type { Scenario, CopilotResponse, Operation, ResolutionOption } from "@/types";

interface DisruptionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  scenario: Scenario;
  onEmergency: (message: string) => Promise<void>;
  onCopilotMessage: (message: string) => Promise<void>;
}

export function DisruptionDrawer({ isOpen, onClose, scenario, onEmergency, onCopilotMessage }: DisruptionDrawerProps) {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState<CopilotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"chat" | "emergency">("emergency");
  const [showVoice, setShowVoice] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      await onEmergency(message);
      // Response will come from parent via prop/context, but for now we'll handle locally
    } finally {
      setLoading(false);
    }
  };

  const handleCopilotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || loading) return;
    setLoading(true);
    try {
      await onCopilotMessage(message);
      setMessage("");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-2xl md:max-w-3xl h-full bg-card border-l border-border flex flex-col shadow-2xl animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-foreground">Emergency Co-Pilot</h2>
              <p className="text-[11px] text-muted-foreground">Mid-term disruption & live CP-SAT re-routing</p>
            </div>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant={mode === "chat" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setMode("chat")}
              className="text-[11px]"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Chat
            </Button>
            <Button
              variant={mode === "emergency" ? "primary" : "ghost"}
              size="sm"
              onClick={() => setMode("emergency")}
              className="text-[11px]"
            >
              <AlertTriangle className="w-3.5 h-3.5 mr-1" />
              Emergency
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="p-1.5">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Message History */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {response && (
            <div className="space-y-3">
              {/* Summary */}
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-xs text-foreground">Muse Spark Diagnosis</span>
                  <Badge variant="info" className="text-[10px]">
                    {response.diagnosis_mode === "muse-spark" ? "Muse Spark" : "Template"}
                  </Badge>
                </div>
                <p className="text-sm text-foreground">{response.diagnosis}</p>
              </div>

              {/* Resolutions */}
              {response.options && response.options.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">Solver-Verified Resolutions</span>
                    <Badge variant="success" className="text-[10px]">
                      <ShieldCheck className="w-2.5 h-2.5 mr-1" />
                      CP-SAT Proven
                    </Badge>
                  </div>
                  {response.options.map((opt, idx) => (
                    <div key={idx} className="bg-card border border-border rounded-lg p-3 hover:border-primary/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                            {idx + 1}
                          </span>
                          <span className="font-medium text-sm text-foreground">{opt.dropped_explanation}</span>
                        </div>
                        <Badge variant={opt.result.status === "optimal" ? "success" : "info"} className="text-[10px]">
                          {opt.result.status.toUpperCase()}
                          {opt.result.objective !== undefined && (
                            <>
                              <span className="ml-1">penalty:{opt.result.objective}</span>
                            </>
                          )}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">{opt.tradeoff}</p>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          // Apply this resolution
                          onCopilotMessage(`Apply resolution ${idx + 1}: ${opt.tradeoff}`);
                        }}
                        className="w-full"
                      >
                        Apply This Resolution
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {/* Healing notes */}
              {response.healing_notes && response.healing_notes.length > 0 && (
                <div className="space-y-1">
                  {response.healing_notes.map((note, idx) => (
                    <div key={idx} className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded p-2">
                      <div className="flex items-start space-x-2 text-xs">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <span className="text-emerald-800 dark:text-emerald-200">{note}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Solver result */}
              {response.result && (
                <div className="bg-muted/50 border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-xs text-foreground">Timetable Regenerated</span>
                    <Badge variant={response.result.status === "optimal" ? "success" : "info"} className="text-[10px]">
                      {response.result.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <span>Solve time: {response.result.solve_time_ms} ms</span>
                    {response.result.objective !== undefined && <span>Preference penalty: {response.result.objective}</span>}
                    {response.result.timetable && <span>Sections placed: {response.result.timetable.placements.length}</span>}
                  </div>
                </div>
              )}
            </div>
          )}

          {!response && (
            <div className="text-center py-8 text-muted-foreground">
              <Brain className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm">Describe an emergency or ask the co-pilot to adjust the schedule.</p>
              <p className="text-[11px] mt-1">Examples: "Dr. Chen is out all week", "Move CS 301 to the big hall", "Prof. Patel can't teach Mondays"</p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 shrink-0">
          <form onSubmit={mode === "emergency" ? handleSubmit : handleCopilotSubmit} className="space-y-2">
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowVoice(!showVoice)}
                className={cn("text-[11px]", showVoice && "bg-primary/10 text-primary")}
              >
                <Mic className="w-3.5 h-3.5 mr-1" />
                Voice
              </Button>
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={mode === "emergency" ? "Dr. Chen is out all week — who could cover her sections?" : "Prof. Patel can't teach Mondays..."}
                  className="w-full bg-input border border-input text-foreground rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  disabled={loading}
                />
              </div>
              <Button
                type="submit"
                disabled={!message.trim() || loading}
                size="sm"
                className="flex items-center space-x-1"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{loading ? "Thinking..." : "Send"}</span>
              </Button>
            </div>

            {/* Quick action chips */}
            <div className="flex flex-wrap gap-1.5">
              <Button type="button" variant="ghost" size="sm" className="text-[10px]" onClick={() => { setMessage("Dr. Chen is out all week — who could cover her sections?"); handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent); }}>
                <AlertTriangle className="w-3 h-3 mr-1" />
                Instructor Out
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-[10px]" onClick={() => { setMessage("Move CS 301 to Science Hall 120"); handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent); }}>
                <RotateCcwIcon className="w-3 h-3 mr-1" />
                Move Section
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-[10px]" onClick={() => { setMessage("Prof. Patel can't teach Mondays — committee duty"); handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent); }}>
                <User className="w-3 h-3 mr-1" />
                Unavailability
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-[10px]" onClick={() => { setMessage("CS 350 enrollment jumped to 45 after registration ended"); handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent); }}>
                <Users className="w-3 h-3 mr-1" />
                Enrollment Surge
              </Button>
              <Button type="button" variant="ghost" size="sm" className="text-[10px]" onClick={() => { setMessage("Science Hall is closed for renovation"); handleSubmit({ preventDefault: () => {} } as unknown as React.FormEvent); }}>
                <Building className="w-3 h-3 mr-1" />
                Room Closed
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  // This is a placeholder - actual handler is in parent
}