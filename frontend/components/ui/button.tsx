"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant =
  "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";

type ButtonSize = "default" | "sm" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-[#d3e7f1] text-[#07020a] hover:bg-white",
  destructive: "bg-red-500/90 text-white hover:bg-red-500",
  outline: "border border-white/20 bg-transparent text-white hover:bg-white/10",
  secondary: "bg-white/12 text-white hover:bg-white/20",
  ghost: "text-white/80 hover:bg-white/10 hover:text-white",
  link: "text-[#d3e7f1] underline-offset-4 hover:underline",
};

const sizeClasses: Record<ButtonSize, string> = {
  default: "min-h-11 px-4 py-2",
  sm: "min-h-11 rounded-md px-3",
  lg: "min-h-11 rounded-md px-8",
  icon: "h-11 w-11",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d3e7f1] disabled:pointer-events-none disabled:opacity-50",
          variantClasses[variant],
          sizeClasses[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
