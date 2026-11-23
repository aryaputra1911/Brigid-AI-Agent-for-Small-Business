"use client";

import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { hasStoredSession } from "@/lib/brigid-api";
import { CornerButton } from "./corner-button";

function subscribeSession(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

export function useLandingSignedIn(): boolean {
  return useSyncExternalStore(subscribeSession, hasStoredSession, () => false);
}

export function toAuthAwareHref(href: string, signedIn: boolean): string {
  if (signedIn) return href;
  return `/login?next=${encodeURIComponent(href)}`;
}

export function SystemLink({
  href,
  children,
  className,
  prefetch,
}: {
  href: string;
  children: ReactNode;
  className?: string;
  prefetch?: boolean;
}) {
  const signedIn = useLandingSignedIn();
  return (
    <Link
      href={toAuthAwareHref(href, signedIn)}
      className={className}
      prefetch={prefetch}
    >
      {children}
    </Link>
  );
}

export function SystemCornerButton({
  href,
  variant = "dark",
  children,
  className,
  ariaLabel,
}: {
  href: string;
  variant?: "dark" | "light";
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const signedIn = useLandingSignedIn();
  return (
    <CornerButton
      href={toAuthAwareHref(href, signedIn)}
      variant={variant}
      className={className}
      ariaLabel={ariaLabel}
    >
      {children}
    </CornerButton>
  );
}

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const signedIn = useLandingSignedIn();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const navItems = useMemo(
    () => [
      { href: toAuthAwareHref("/chat", signedIn), label: "CHAT" },
      { href: toAuthAwareHref("/approvals", signedIn), label: "APPROVALS" },
      { href: toAuthAwareHref("/mandate", signedIn), label: "MANDATE" },
      { href: "/login", label: "LOGIN" },
    ],
    [signedIn],
  );

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const closeMenu = () => {
    setMenuOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <>
      <header
        className={`rre-header ${scrolled ? "is-scrolled" : ""}`}
        role="banner"
      >
        <div className="rre-header__inner">
          <Link href="#top" className="rre-brand" aria-label="Brigid home">
            <Image
              src="/brand/brigid.svg"
              alt=""
              width={28}
              height={28}
              className="rre-brand__mark"
            />
            <span className="rre-brand__name">BRIGID</span>
          </Link>

          <nav className="rre-nav" aria-label="Primary navigation">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="rre-nav__link">
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            ref={triggerRef}
            type="button"
            className="rre-menu-btn"
            aria-expanded={menuOpen}
            aria-controls="rre-mobile-drawer"
            onClick={() => setMenuOpen(true)}
          >
            <Menu size={18} strokeWidth={1.75} aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>
      </header>

      {menuOpen && (
        <div
          id="rre-mobile-drawer"
          className="rre-drawer"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
        >
          <div className="rre-drawer__top">
            <Link
              href="#top"
              className="rre-brand"
              onClick={() => setMenuOpen(false)}
            >
              <Image
                src="/brand/brigid.svg"
                alt=""
                width={28}
                height={28}
                className="rre-brand__mark"
              />
              <span className="rre-brand__name">BRIGID</span>
            </Link>
            <button
              ref={closeRef}
              type="button"
              className="rre-menu-btn"
              onClick={closeMenu}
              aria-label="Close navigation menu"
            >
              <X size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>Close</span>
            </button>
          </div>

          <nav className="rre-drawer__nav" aria-label="Mobile navigation">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rre-drawer__link"
                onClick={() => setMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <p className="rre-drawer__note">
            Local finance simulation workspace using synthetic business data.
          </p>
        </div>
      )}
    </>
  );
}
