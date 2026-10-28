"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Modal({ isOpen, onClose, title, children, footer, size = "md" }: ModalProps) {
  if (!isOpen) return null;

  const sizes = {
    sm: "w-80",
    md: "w-96",
    lg: "w-[40rem]",
    xl: "w-[50rem]",
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={cn(
          "bg-card border border-border rounded-xl shadow-2xl p-4 text-sm space-y-3 max-h-[80vh] overflow-y-auto",
          sizes[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border pb-2">
          <h3 id="modal-title" className="font-extrabold text-sm text-foreground">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground font-bold p-1 rounded hover:bg-accent transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div>{children}</div>
        {footer && (
          <div className="flex items-center justify-end pt-2 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}