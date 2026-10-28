"use client";

import { cn } from "@/lib/utils";
import { Info, CheckCircle2, AlertTriangle, XCircle, X } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "info" | "success" | "warning" | "error";
  onClose: () => void;
}

const icons = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  error: XCircle,
};

const colors = {
  info: "bg-slate-900 text-white border-slate-700",
  success: "bg-green-900 text-white border-green-700",
  warning: "bg-amber-900 text-white border-amber-700",
  error: "bg-red-900 text-white border-red-700",
};

const iconColors = {
  info: "text-sky-400",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-red-400",
};

export function Toast({ message, type = "info", onClose }: ToastProps) {
  const Icon = icons[type];
  return (
    <div
      className={cn(
        "fixed bottom-10 right-5 px-3 py-2 rounded-lg shadow-xl border text-xs font-medium transform transition-all duration-300 pointer-events-none z-50 flex items-center space-x-2",
        colors[type]
      )}
      role="alert"
    >
      <Icon className={cn("w-4 h-4 flex-shrink-0", iconColors[type])} />
      <span>{message}</span>
      <button
        onClick={onClose}
        className="ml-2 p-0.5 rounded hover:bg-white/10 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}