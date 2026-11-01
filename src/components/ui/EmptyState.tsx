import React from "react";
import { FolderSearch, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  className,
  icon,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl border border-dashed border-border bg-surface-1/40",
        className
      )}
    >
      <div className="p-3.5 rounded-full bg-surface-2 text-foreground-muted mb-3 border border-border">
        {icon || <FolderSearch className="w-6 h-6" />}
      </div>
      <h4 className="text-base font-medium text-foreground">{title}</h4>
      <p className="text-xs text-foreground-secondary max-w-sm mt-1 mb-4 leading-relaxed">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "An Error Occurred",
  message,
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center p-6 text-center rounded-xl border border-danger/30 bg-danger/5",
        className
      )}
    >
      <div className="p-3 rounded-full bg-danger/10 text-danger mb-3 border border-danger/20">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-danger">{title}</h4>
      <p className="text-xs text-foreground-secondary max-w-md mt-1 mb-4 font-mono leading-relaxed">
        {message}
      </p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Operation</span>
        </Button>
      )}
    </div>
  );
};
