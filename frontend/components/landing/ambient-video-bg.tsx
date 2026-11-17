"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";
import { useSaveData } from "@/lib/use-save-data";

/**
 * Full-viewport fixed background video for the RRE-inspired editorial layout.
 * Uses /media/brigid-demo.mp4 with /media/brigid-demo-poster.webp as static
 * poster/fallback, plus a dark scrim for WCAG AA text contrast and a
 * keyboard-accessible Pause/Play control.
 */
export function AmbientVideoBg() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useMediaQuery(
    "(prefers-reduced-motion: reduce)",
    false,
  );
  const saveData = useSaveData();
  const [userPaused, setUserPaused] = useState(false);

  const shouldPlay = !reducedMotion && !userPaused && !saveData;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVisibility = () => {
      if (document.visibilityState !== "visible") {
        video.pause();
      } else if (shouldPlay) {
        void video.play().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    if (shouldPlay && document.visibilityState === "visible") {
      void video.play().catch(() => {});
    } else {
      video.pause();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [shouldPlay]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      void video.play().catch(() => {});
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  return (
    <>
      <div className="rre-bg-layer" aria-hidden="true">
        <video
          ref={videoRef}
          className="rre-bg-video"
          width={1920}
          height={1080}
          poster="/media/brigid-demo-poster.webp"
          muted
          loop
          playsInline
          autoPlay={!reducedMotion && !saveData}
          preload={shouldPlay ? "metadata" : "none"}
        >
          <source src="/media/brigid-demo.mp4" type="video/mp4" />
        </video>
        <div className="rre-bg-scrim" />
      </div>

      <button
        type="button"
        className="rre-video-control"
        onClick={togglePlayback}
        aria-label={
          shouldPlay ? "Pause background video" : "Play background video"
        }
        aria-pressed={shouldPlay}
      >
        {shouldPlay ? (
          <Pause size={15} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Play size={15} strokeWidth={1.75} aria-hidden="true" />
        )}
        <span>{shouldPlay ? "Pause video" : "Play video"}</span>
      </button>
    </>
  );
}
