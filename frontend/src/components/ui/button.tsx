"use client";

import { cn } from "@/lib/utils";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "destructive" | "ghost" | "outline";
  size?: "sm" | "md" | "lg";
}

export function Button({
  className,
  variant = "primary",
  size = "sm",
  disabled,
  children,
  onClick,
  ...props
}: ButtonProps) {
  const variants = {
    primary:
      "bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:bg-primary/90 active:bg-primary",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
    destructive:
      "bg-destructive text-destructive-foreground shadow-sm shadow-destructive/25 hover:bg-destructive/90",
    ghost: "hover:bg-accent hover:text-accent-foreground",
    outline:
      "border border-input bg-card shadow-sm hover:border-primary/40 hover:bg-accent hover:text-accent-foreground",
  };

  // md/lg meet the 40–44px touch-target floor; sm stays compact on desktop rows.
  const sizes = {
    sm: "min-h-9 px-3 py-1.5 text-xs gap-1.5",
    md: "min-h-11 px-4 py-2 text-sm gap-2",
    lg: "min-h-12 px-6 py-3 text-base gap-2",
  };

  return (
    <button
      className={cn(
        "inline-flex touch-manipulation items-center justify-center rounded-xl font-semibold",
        "transition-all duration-150 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}
