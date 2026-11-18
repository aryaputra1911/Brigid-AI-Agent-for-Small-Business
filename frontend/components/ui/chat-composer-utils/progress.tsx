"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number | null;
  type?: "bar" | "circle";
  size?: "sm" | "md";
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, type = "bar", size = "md", ...props }, ref) => {
    if (type === "circle") {
      return (
        <div
          ref={ref}
          role="progressbar"
          aria-valuenow={value ?? undefined}
          className={cn("inline-flex items-center justify-center", className)}
          {...props}
        >
          <Loader2
            className={cn("animate-spin", size === "sm" ? "size-4" : "size-5")}
            aria-hidden="true"
          />
        </div>
      );
    }

    const clamped =
      typeof value === "number" ? Math.max(0, Math.min(100, value)) : 0;

    return (
      <div
        ref={ref}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={typeof value === "number" ? clamped : undefined}
        className={cn(
          "relative h-2 w-full overflow-hidden rounded-full bg-white/15",
          className,
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full bg-current transition-all",
            value === null && "w-1/3 animate-progress-indeterminate",
          )}
          style={
            typeof value === "number" ? { width: `${clamped}%` } : undefined
          }
        />
      </div>
    );
  },
);
Progress.displayName = "Progress";

export { Progress };
