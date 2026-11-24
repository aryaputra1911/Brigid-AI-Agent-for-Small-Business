import type { ReactNode, Ref } from "react";
import { ChatIcon, type ChatIconName } from "@/components/ui/chat-icon";
import "./finance-pages.css";

export function FinanceHeading({
  id,
  title,
  description,
  kicker,
  icon,
  role,
  headingRef,
  stackContext = false,
  children,
}: {
  id: string;
  title: string;
  description: string;
  kicker?: string;
  icon?: ChatIconName;
  role: string;
  headingRef?: Ref<HTMLHeadingElement>;
  stackContext?: boolean;
  children?: ReactNode;
}) {
  return (
    <header className="paper-finance-heading">
      {kicker && (
        <span className="paper-finance-kicker">
          {icon && <ChatIcon name={icon} />}
          {kicker}
        </span>
      )}
      <h1 id={id} ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p>{description}</p>
      <div
        className={`paper-finance-context${stackContext ? " paper-finance-context-stack" : ""}`}
      >
        <span>
          {role ? (
            <>
              Acting as <strong>{role}</strong>
            </>
          ) : (
            "Connecting to Brigid"
          )}
        </span>
        {children}
      </div>
    </header>
  );
}

export function FinanceState({
  title,
  description,
  icon,
  tone = "neutral",
  role,
  children,
}: {
  title: string;
  description: string;
  icon?: ChatIconName;
  tone?: "neutral" | "error";
  role?: "alert" | "status";
  children?: ReactNode;
}) {
  return (
    <div
      className={`paper-finance-state paper-finance-state-${tone}`}
      role={role}
    >
      {icon && (
        <span className="paper-finance-state-icon">
          <ChatIcon name={icon} />
        </span>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </div>
  );
}

/** Inline status/error notice rendered with distinct tone styling and icon. */
export function FinanceNotice({
  text,
  tone,
}: {
  text: string;
  tone: "success" | "error";
}) {
  return (
    <div
      className={`paper-inline-notice paper-inline-notice-${tone}`}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="paper-inline-notice-icon" aria-hidden="true">
        <ChatIcon name={tone === "error" ? "close" : "check"} />
      </span>
      <span>{text}</span>
    </div>
  );
}
