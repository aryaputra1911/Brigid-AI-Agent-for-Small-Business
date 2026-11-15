"use client";

import Image from "next/image";
import { useMediaQuery } from "@/lib/use-media-query";

export function BrigidLogo({
  state = "idle",
  className = "",
  decorative = false,
}: {
  state?: "idle" | "processing" | "reply";
  className?: string;
  decorative?: boolean;
}) {
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const shouldAnimate = state !== "idle" && !reduceMotion;

  return (
    <span
      className={`brigid-logo ${className}`}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : "Brigid"}
      aria-hidden={decorative ? true : undefined}
      data-state={state}
      data-playback={shouldAnimate ? "playing" : "static"}
    >
      <span className="brigid-logo-mark">
        <Image
          src="/brand/brigid.svg"
          alt=""
          width={32}
          height={32}
          unoptimized
        />
      </span>
    </span>
  );
}
