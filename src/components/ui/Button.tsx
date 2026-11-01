import React from "react";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger" | "subtle" | "inverse";
  size?: "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";
  isLoading?: boolean;
}

export const buttonStyles = ({
  variant = "primary",
  size = "md",
}: Pick<ButtonProps, "variant" | "size"> = {}) => {
  const base =
    "inline-flex items-center justify-center whitespace-nowrap font-medium rounded-md transition-[background-color,border-color,color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 select-none";

  const variants = {
    primary:
      "bg-primary text-white hover:bg-primary-hover shadow-[inset_0_1px_0_0_rgb(255_255_255/0.16),0_1px_2px_0_rgb(0_0_0/0.4)]",
    inverse:
      "bg-foreground text-background hover:bg-white shadow-[0_1px_2px_0_rgb(0_0_0/0.4)]",
    secondary:
      "bg-surface-2 text-foreground border border-border hover:bg-surface-3 hover:border-border-strong shadow-[inset_0_1px_0_0_rgb(255_255_255/0.03)]",
    outline:
      "bg-transparent text-foreground border border-border hover:border-border-strong hover:bg-surface-2",
    ghost: "bg-transparent text-foreground-secondary hover:text-foreground hover:bg-surface-2",
    danger: "bg-danger/10 text-danger border border-danger/25 hover:bg-danger/15 hover:border-danger/40",
    subtle: "bg-primary/10 text-primary-light border border-primary/20 hover:bg-primary/15 hover:border-primary/30",
  };

  const sizes = {
    xs: "h-6 px-2 text-2xs gap-1",
    sm: "h-7 px-2.5 text-xs gap-1.5",
    md: "h-8 px-3.5 text-[13px] gap-2",
    lg: "h-10 px-5 text-sm gap-2",
    icon: "h-8 w-8 p-0",
    "icon-sm": "h-7 w-7 p-0",
  };

  return cn(base, variants[variant], sizes[size]);
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", isLoading = false, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(buttonStyles({ variant, size }), className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
