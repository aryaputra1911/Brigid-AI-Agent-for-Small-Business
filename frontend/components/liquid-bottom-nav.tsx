"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState } from "react";
import { ChatIcon, type ChatIconName } from "@/components/ui/chat-icon";
import "./liquid-bottom-nav.css";

const ITEMS: { href: string; label: string; icon: ChatIconName }[] = [
  { href: "/chat", label: "Chat", icon: "chat" },
  { href: "/invoices", label: "Invoices", icon: "invoice" },
  { href: "/transactions", label: "Cash", icon: "chart" },
  { href: "/approvals", label: "Approvals", icon: "check" },
  { href: "/profile", label: "Profile", icon: "user" },
];

const SWIPE_THRESHOLD_PX = 60;

export function LiquidBottomNav({ pendingCount }: { pendingCount: number }) {
  const pathname = usePathname();
  const [hiddenSide, setHiddenSide] = useState<"left" | "right" | null>(null);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const startRef = useRef<{ x: number; y: number; moved: boolean } | null>(
    null,
  );
  const suppressClickRef = useRef(false);

  function onNavPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (hiddenSide !== null) return;
    startRef.current = { x: event.clientX, y: event.clientY, moved: false };
    suppressClickRef.current = false;
  }

  function onNavPointerMove(event: React.PointerEvent<HTMLElement>) {
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (!start.moved) {
      if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;
      start.moved = true;
      suppressClickRef.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    setDragX(dx);
  }

  function onNavPointerEnd(event: React.PointerEvent<HTMLElement>) {
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    if (start.moved) {
      if (dx <= -SWIPE_THRESHOLD_PX) {
        setHiddenSide("left");
      } else if (dx >= SWIPE_THRESHOLD_PX) {
        setHiddenSide("right");
      }
    }
    startRef.current = null;
    setDragging(false);
    setDragX(0);
    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }

  function onHandlePointerEnd(event: React.PointerEvent<HTMLButtonElement>) {
    const start = startRef.current;
    if (!start) return;
    const dx = event.clientX - start.x;
    startRef.current = null;
    if (
      (hiddenSide === "left" && dx >= 24) ||
      (hiddenSide === "right" && dx <= -24)
    ) {
      setHiddenSide(null);
    }
  }

  const navClass = [
    "brigid-bnav",
    dragging ? "is-dragging" : "",
    hiddenSide === "left" ? "is-hidden-left" : "",
    hiddenSide === "right" ? "is-hidden-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="brigid-bnav-wrap">
      <nav
        aria-label="Mobile navigation"
        className={navClass}
        aria-hidden={hiddenSide !== null}
        style={dragging ? { transform: `translateX(${dragX}px)` } : undefined}
        onPointerDown={onNavPointerDown}
        onPointerMove={onNavPointerMove}
        onPointerUp={onNavPointerEnd}
        onPointerCancel={onNavPointerEnd}
      >
        {ITEMS.map((item) => {
          const active =
            pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              draggable={false}
              tabIndex={hiddenSide !== null ? -1 : undefined}
              className={`brigid-bnav-item${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={(event) => {
                if (suppressClickRef.current) event.preventDefault();
              }}
            >
              <ChatIcon name={item.icon} />
              <span>{item.label}</span>
              {item.href === "/approvals" && pendingCount > 0 && (
                <span
                  className="brigid-bnav-badge"
                  aria-label={`${pendingCount} pending`}
                >
                  {pendingCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {hiddenSide !== null && (
        <button
          type="button"
          className={`brigid-bnav-handle is-${hiddenSide}`}
          aria-label="Show navigation bar"
          title="Show navigation bar"
          onPointerDown={(event) => {
            startRef.current = {
              x: event.clientX,
              y: event.clientY,
              moved: false,
            };
          }}
          onPointerUp={onHandlePointerEnd}
          onClick={() => setHiddenSide(null)}
        >
          <ChatIcon
            name={hiddenSide === "left" ? "chevronRight" : "chevronLeft"}
          />
        </button>
      )}
    </div>
  );
}
