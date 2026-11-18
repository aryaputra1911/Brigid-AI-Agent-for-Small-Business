"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type TooltipContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  id: string;
};

const TooltipContext = React.createContext<TooltipContextValue | null>(null);

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();
  return (
    <TooltipContext.Provider value={{ open, setOpen, id }}>
      <span className="relative inline-flex">{children}</span>
    </TooltipContext.Provider>
  );
}

type TooltipTriggerProps = {
  render?: React.ReactElement<React.HTMLAttributes<HTMLElement>>;
  children?: React.ReactNode;
};

function TooltipTrigger({ render, children }: TooltipTriggerProps) {
  const ctx = React.useContext(TooltipContext);
  const triggerProps: React.HTMLAttributes<HTMLElement> = {
    onMouseEnter: () => ctx?.setOpen(true),
    onMouseLeave: () => ctx?.setOpen(false),
    onFocus: () => ctx?.setOpen(true),
    onBlur: () => ctx?.setOpen(false),
    "aria-describedby": ctx?.open ? ctx.id : undefined,
  };

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render, {
      ...triggerProps,
      onMouseEnter: (e) => {
        render.props.onMouseEnter?.(e);
        triggerProps.onMouseEnter?.(e);
      },
      onMouseLeave: (e) => {
        render.props.onMouseLeave?.(e);
        triggerProps.onMouseLeave?.(e);
      },
      onFocus: (e) => {
        render.props.onFocus?.(e);
        triggerProps.onFocus?.(e);
      },
      onBlur: (e) => {
        render.props.onBlur?.(e);
        triggerProps.onBlur?.(e);
      },
    });
  }

  return <span {...triggerProps}>{children}</span>;
}

function TooltipContent({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  const ctx = React.useContext(TooltipContext);
  if (!ctx?.open) return null;
  return (
    <span
      id={ctx.id}
      role="tooltip"
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-white/20 bg-[#100914] px-2.5 py-1 text-xs text-white shadow-md",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider };
