import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-all duration-150 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none active:scale-[0.98]";

    const variants = {
      primary:
        "bg-primary hover:bg-primary-hover text-white shadow-sm hover:shadow-[0_0_20px_rgba(130,56,232,0.35)] border border-primary-light/20",
      secondary:
        "bg-surface-2 hover:bg-surface-hover text-foreground border border-border hover:border-border-strong",
      outline:
        "bg-transparent border border-border hover:border-primary-light/50 text-foreground hover:bg-surface-1",
      ghost:
        "bg-transparent text-foreground-secondary hover:text-foreground hover:bg-surface-hover",
      danger:
        "bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 hover:border-danger/50",
      subtle:
        "bg-primary-subtle/40 text-primary-light border border-primary/20 hover:bg-primary-subtle/70",
    };

    const sizes = {
      sm: "h-8 px-3 text-xs gap-1.5",
      md: "h-9 px-4 text-sm gap-2",
      lg: "h-11 px-6 text-base gap-2.5",
      icon: "h-9 w-9 p-0",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
