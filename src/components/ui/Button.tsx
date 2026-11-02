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
    "inline-flex items-center justify-center whitespace-nowrap font-medium rounded-md tracking-[-0.006em] transition-[background-color,border-color,color,box-shadow] duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45 select-none [&>svg]:shrink-0";

  const variants = {
    primary:
      "bg-primary text-white hover:bg-primary-hover shadow-[inset_0_1px_0_0_rgb(255_255_255/0.14),0_1px_2px_0_rgb(25_24_29/0.12)]",
    inverse:
      "bg-foreground text-white hover:bg-foreground/85 shadow-[0_1px_2px_0_rgb(25_24_29/0.12)]",
    secondary:
      "bg-surface-1 text-foreground border border-border-strong hover:bg-surface-2 shadow-panel",
    outline:
      "bg-transparent text-foreground border border-border-strong hover:bg-surface-2",
    ghost: "bg-transparent text-foreground-secondary hover:text-foreground hover:bg-surface-3",
    danger: "bg-surface-1 text-danger border border-danger/35 hover:bg-danger/[0.06] hover:border-danger/50",
    subtle: "bg-primary-subtle text-primary-light border border-primary/15 hover:border-primary/30",
  };

  const sizes = {
    xs: "h-7 px-2 text-xs gap-1 [&>svg]:w-3.5 [&>svg]:h-3.5",
    sm: "h-8 px-3 text-[13px] gap-1.5 [&>svg]:w-3.5 [&>svg]:h-3.5",
    md: "h-9 px-4 text-[13px] gap-2 [&>svg]:w-4 [&>svg]:h-4",
    lg: "h-11 px-5 text-[15px] gap-2 [&>svg]:w-4 [&>svg]:h-4",
    icon: "h-9 w-9 p-0",
    "icon-sm": "h-8 w-8 p-0",
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
