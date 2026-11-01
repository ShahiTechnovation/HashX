import React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn("input", className)} {...props} />
);
Input.displayName = "Input";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select ref={ref} className={cn("select w-auto", className)} {...props}>
      {children}
    </select>
  )
);
Select.displayName = "Select";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn("input h-auto min-h-[80px] py-2 leading-relaxed", className)} {...props} />
  )
);
Textarea.displayName = "Textarea";

export const SearchInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { wrapperClassName?: string }> = ({
  className,
  wrapperClassName,
  ...props
}) => (
  <div className={cn("relative", wrapperClassName)}>
    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none" />
    <input type="search" className={cn("input pl-8", className)} {...props} />
  </div>
);

interface FieldProps {
  label: React.ReactNode;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, htmlFor, hint, error, children, className }) => (
  <div className={cn("space-y-1.5", className)}>
    <label htmlFor={htmlFor} className="block text-xs font-medium text-foreground-secondary">
      {label}
    </label>
    {children}
    {error ? (
      <p className="text-2xs text-danger">{error}</p>
    ) : hint ? (
      <p className="text-2xs text-foreground-muted leading-relaxed">{hint}</p>
    ) : null}
  </div>
);

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode; count?: number }>;
  className?: string;
  size?: "sm" | "md";
}

/** Segmented control for filters and tabs. */
export function Segmented<T extends string>({ value, onChange, options, className, size = "md" }: SegmentedProps<T>) {
  return (
    <div role="tablist" className={cn("inline-flex items-center gap-0.5 rounded-md bg-surface-2/70 p-0.5 ring-1 ring-inset ring-border", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-[5px] font-medium transition-colors duration-150 whitespace-nowrap",
              size === "sm" ? "h-6 px-2 text-2xs" : "h-7 px-2.5 text-xs",
              active
                ? "bg-surface-3 text-foreground shadow-[inset_0_1px_0_0_rgb(255_255_255/0.05),0_1px_2px_rgb(0_0_0/0.3)]"
                : "text-foreground-muted hover:text-foreground"
            )}
          >
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn("tabular-nums text-2xs", active ? "text-foreground-secondary" : "text-foreground-muted/80")}>
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Underlined tabs for switching page sections. */
export function Tabs<T extends string>({ value, onChange, options, className }: Omit<SegmentedProps<T>, "size">) {
  return (
    <div role="tablist" className={cn("flex items-center gap-5 border-b border-border", className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "relative -mb-px inline-flex items-center gap-1.5 h-9 text-[13px] font-medium border-b transition-colors",
              active ? "text-foreground border-foreground" : "text-foreground-muted border-transparent hover:text-foreground-secondary"
            )}
          >
            {opt.label}
            {opt.count !== undefined && <span className="text-2xs tabular-nums text-foreground-muted">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
