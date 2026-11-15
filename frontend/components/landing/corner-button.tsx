import Link from "next/link";
import type { ReactNode } from "react";

interface CornerButtonProps {
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  variant?: "dark" | "light";
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}

export function CornerButton({
  href,
  onClick,
  type = "button",
  variant = "dark",
  children,
  className = "",
  ariaLabel,
}: CornerButtonProps) {
  const classes = `rre-corner-btn rre-corner-btn--${variant} ${className}`.trim();

  const corners = (
    <>
      <span className="rre-corner rre-corner--tl" aria-hidden="true" />
      <span className="rre-corner rre-corner--tr" aria-hidden="true" />
      <span className="rre-corner rre-corner--bl" aria-hidden="true" />
      <span className="rre-corner rre-corner--br" aria-hidden="true" />
      <span className="rre-corner-btn__label">{children}</span>
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes} aria-label={ariaLabel}>
        {corners}
      </Link>
    );
  }

  return (
    <button
      type={type}
      onClick={onClick}
      className={classes}
      aria-label={ariaLabel}
    >
      {corners}
    </button>
  );
}
