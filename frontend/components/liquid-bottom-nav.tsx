"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import {
  ChartColumn,
  Check,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ReceiptText,
  User,
} from "lucide-react";
import {
  LiquidNavbar,
  type LiquidNavItem,
} from "@/components/ui/liquid-glass-navbar";
import "./liquid-bottom-nav.css";

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

  const items = useMemo<LiquidNavItem[]>(
    () => [
      {
        href: "/chat",
        label: "Chat",
        icon: <MessageSquare size={18} strokeWidth={1.8} aria-hidden="true" />,
        fx: "glow",
      },
      {
        href: "/invoices",
        label: "Invoices",
        icon: <ReceiptText size={18} strokeWidth={1.8} aria-hidden="true" />,
        fx: "pop",
      },
      {
        href: "/transactions",
        label: "Cash",
        icon: <ChartColumn size={18} strokeWidth={1.8} aria-hidden="true" />,
        fx: "wave",
      },
      {
        href: "/approvals",
        label: "Approvals",
        icon: <Check size={18} strokeWidth={1.8} aria-hidden="true" />,
        fx: "drop",
        badge: pendingCount,
      },
      {
        href: "/profile",
        label: "Profile",
        icon: <User size={18} strokeWidth={1.8} aria-hidden="true" />,
        fx: "pop",
      },
    ],
    [pendingCount],
  );

  const activeIndex = useMemo(() => {
    const idx = items.findIndex(
      (item) =>
        item.href &&
        (pathname === item.href || pathname.startsWith(`${item.href}/`)),
    );
    return idx >= 0 ? idx : 0;
  }, [items, pathname]);

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
      <LiquidNavbar
        items={items}
        active={activeIndex}
        tone="dark"
        ariaLabel="Mobile navigation"
        ariaHidden={hiddenSide !== null}
        tabIndex={hiddenSide !== null ? -1 : undefined}
        draggableItems={false}
        className={navClass}
        itemClassName="brigid-bnav-item"
        badgeClassName="brigid-bnav-badge"
        style={dragging ? { transform: `translateX(${dragX}px)` } : undefined}
        onItemClick={(event) => {
          if (suppressClickRef.current) event.preventDefault();
        }}
        onPointerDown={onNavPointerDown}
        onPointerMove={onNavPointerMove}
        onPointerUp={onNavPointerEnd}
        onPointerCancel={onNavPointerEnd}
      />

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
          {hiddenSide === "left" ? (
            <ChevronRight size={20} strokeWidth={1.8} aria-hidden="true" />
          ) : (
            <ChevronLeft size={20} strokeWidth={1.8} aria-hidden="true" />
          )}
        </button>
      )}
    </div>
  );
}
