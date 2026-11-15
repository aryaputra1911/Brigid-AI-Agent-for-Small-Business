"use client";

import Image from "next/image";
import Link from "next/link";
import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useMediaQuery } from "@/lib/use-media-query";

/**
 * Lightweight, CLS-free video showcase for the landing hero.
 * Plays automatically only when visible, foregrounded, and reduced motion is off.
 * Falls back cleanly to a static simulation preview when no video file is present yet.
 */
export function LandingVideo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)", true);
  const [hasSource, setHasSource] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const [inView, setInView] = useState(true);

  const shouldPlay = hasSource && !reducedMotion && !userPaused && inView;

  useEffect(() => {
    const node = containerRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setInView(entry.isIntersecting);
      },
      { threshold: 0.2 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasSource) return;

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
  }, [shouldPlay, hasSource]);

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
    <div className="wl-video-frame" ref={containerRef}>
      {hasSource && (
        <video
          ref={videoRef}
          className={`wl-video-element ${isLoaded ? "is-ready" : ""}`}
          width={1280}
          height={720}
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Brigid workspace walkthrough video"
          onLoadedData={() => setIsLoaded(true)}
        >
          <source src="/media/brigid-demo.webm" type="video/webm" />
          <source
            src="/media/brigid-demo.mp4"
            type="video/mp4"
            onError={() => {
              setHasSource(false);
              setIsLoaded(false);
            }}
          />
        </video>
      )}

      {(!hasSource || !isLoaded) && (
        <div className="wl-video-fallback">
          <div className="wl-video-fallback-top">
            <span className="wl-mono-tag">Simulation preview</span>
            <span className="wl-mono-tag wl-mono-muted">
              {hasSource
                ? "Loading video"
                : "Video slot: /media/brigid-demo.webm"}
            </span>
          </div>
          <div className="wl-preview-card">
            <div className="wl-preview-card-heading">
              <Image src="/brand/brigid.svg" alt="" width={24} height={24} />
              <span>Example prompt</span>
            </div>
            <p>
              Reconcile September bank transactions and flag any invoice that
              needs owner review.
            </p>
            <div className="wl-preview-card-bottom">
              <span>Runs against synthetic business data.</span>
              <Link className="wl-button wl-button-primary" href="/chat">
                Open chat
              </Link>
            </div>
          </div>
        </div>
      )}

      {hasSource && isLoaded && (
        <div className="wl-video-controls">
          <span className="wl-mono-tag">Walkthrough</span>
          <button
            type="button"
            className="wl-video-toggle"
            onClick={togglePlayback}
            aria-label={
              userPaused || reducedMotion ? "Play video" : "Pause video"
            }
            aria-pressed={!userPaused && !reducedMotion}
          >
            {userPaused || reducedMotion ? (
              <Play size={16} strokeWidth={1.75} aria-hidden="true" />
            ) : (
              <Pause size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
            <span>{userPaused || reducedMotion ? "Play" : "Pause"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
