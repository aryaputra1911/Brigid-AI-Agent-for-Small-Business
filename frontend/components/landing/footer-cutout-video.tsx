"use client";

import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSaveData } from "@/lib/use-save-data";

/**
 * Lazy-loaded footer cutout video. Defers attaching the MP4 source until the
 * footer approaches the viewport and skips playback on reduced motion or Save-Data.
 */
export function FooterCutoutVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
    false,
  );
  const saveData = useSaveData();
  const [activated, setActivated] = useState(false);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        setInView(visible);
        if (visible) setActivated(true);
      },
      { rootMargin: "200px" },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  const shouldPlay = activated && inView && !reducedMotion && !saveData;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (shouldPlay) {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [shouldPlay]);

  return (
    <video
      ref={videoRef}
      className="rre-footer__cutout-video"
      width={640}
      height={260}
      poster="/media/brigid-demo-poster.webp"
      muted
      loop
      playsInline
      preload={activated && !saveData && !reducedMotion ? "metadata" : "none"}
    >
      {activated && !saveData && !reducedMotion && (
        <source src="/media/brigid-demo.mp4" type="video/mp4" />
      )}
    </video>
  );
}
