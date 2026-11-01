import React from "react";
import { Inbox, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./Button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  action?: React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  action,
  className,
  icon,
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-2 ring-1 ring-inset ring-border text-foreground-muted mb-4">
        {icon || <Inbox className="w-[18px] h-[18px]" />}
      </div>
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <p className="text-[13px] text-foreground-muted max-w-sm mt-1 leading-relaxed">{description}</p>
      {(action || (actionLabel && onAction)) && (
        <div className="mt-5">
          {action ?? (
            <Button variant="secondary" size="sm" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
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
  title = "Something went wrong",
  message,
  onRetry,
  className,
}) => {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center rounded-lg border border-danger/20 bg-danger/[0.04]", className)}>
      <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-danger/10 ring-1 ring-inset ring-danger/20 text-danger mb-4">
        <AlertTriangle className="w-[18px] h-[18px]" />
      </div>
      <h4 className="text-sm font-medium text-foreground">{title}</h4>
      <p className="text-xs text-foreground-secondary max-w-md mt-1.5 font-mono leading-relaxed">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-5">
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
};
