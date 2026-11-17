"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ChatIcon, type ChatIconName } from "./chat-icon";
import { useWebGlSupport } from "@/lib/use-webgl-support";

const PromptMesh = dynamic(() => import("./prompt-mesh"), { ssr: false });

export function PromptCard({
  text,
  icon,
  disabled,
  meshDelayMs = 0,
  onSelect,
}: {
  text: string;
  icon: ChatIconName;
  disabled: boolean;
  meshDelayMs?: number;
  onSelect: () => void;
}) {
  const supported = useWebGlSupport();
  const [meshReady, setMeshReady] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const timer = window.setTimeout(
      () => setMeshReady(true),
      Math.max(0, meshDelayMs),
    );
    return () => window.clearTimeout(timer);
  }, [supported, meshDelayMs]);
  return (
    <button
      className="paper-prompt"
      data-chat-intro="prompt"
      type="button"
      disabled={disabled}
      onClick={onSelect}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setHovered(true);
      }}
      onPointerLeave={() => setHovered(false)}
      onPointerCancel={() => setHovered(false)}
      onFocus={(event) =>
        setFocused(event.currentTarget.matches(":focus-visible"))
      }
      onBlur={() => setFocused(false)}
    >
      <span className="paper-prompt-surface" aria-hidden="true">
        {supported && meshReady && (
          <PromptMesh active={!disabled && (hovered || focused)} />
        )}
      </span>
      <span className="paper-prompt-text">{text}</span>
      <span className="paper-prompt-icon">
        <ChatIcon name={icon} />
      </span>
    </button>
  );
}
