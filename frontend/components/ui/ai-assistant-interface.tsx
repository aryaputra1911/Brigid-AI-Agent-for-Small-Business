"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { animate, motion } from "motion/react";
import { Mic, Paperclip, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useWorkspace, type Message } from "@/components/workspace-provider";
import { ChatIcon, type ChatIconName } from "./chat-icon";
import { BrigidLogo } from "./brigid-logo";
import { ChatBackground } from "./chat-background";
import { PromptCard } from "./prompt-card";
import {
  ChatComposerAction,
  ChatComposerFooter,
  ChatComposerFrame,
  ChatComposerInput,
  ChatComposerProvider,
  ChatComposerSubmit,
} from "./chat-composer";
import { useMediaQuery } from "@/lib/use-media-query";

const prompts: { text: string; icon: ChatIconName }[] = [
  {
    text: "Reconcile recent transactions and flag anything that needs review",
    icon: "chart",
  },
  {
    text: "Project our cash position for the next four weeks",
    icon: "calendar",
  },
  {
    text: "Review outstanding invoices and tell me what is due",
    icon: "invoice",
  },
  { text: "Suggest ways to improve our business cash flow", icon: "bulb" },
];

function FutureControl({
  icon,
  label,
  text,
}: {
  icon: ChatIconName;
  label: string;
  text?: string;
}) {
  return (
    <button
      className="paper-future-control paper-icon-button"
      type="button"
      disabled
      aria-label={`${label}, coming soon`}
      title={`${label}: Coming soon`}
    >
      <ChatIcon name={icon} />
      {text && <span>{text}</span>}
    </button>
  );
}

function MessageRow({
  children,
  className,
  reducedMotion,
  animateEntry = true,
  role,
}: {
  children: ReactNode;
  className: string;
  reducedMotion: boolean;
  animateEntry?: boolean;
  role?: "status";
}) {
  return (
    <motion.li
      className={className}
      role={role}
      initial={
        animateEntry && !reducedMotion
          ? { opacity: 0, transform: "translateY(8px)" }
          : false
      }
      animate={{ opacity: 1, transform: "translateY(0px)" }}
      transition={{
        duration: reducedMotion ? 0 : 0.24,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      {children}
    </motion.li>
  );
}

function AssistantMessage({
  message,
  reducedMotion,
  animateEntry,
}: {
  message: Message;
  reducedMotion: boolean;
  animateEntry: boolean;
}) {
  const [copyStatus, setCopyStatus] = useState("");
  async function copy() {
    try {
      await navigator.clipboard.writeText(message.text);
      setCopyStatus("Copied to clipboard");
    } catch {
      setCopyStatus(
        "Could not copy. Select the reply text and copy it manually.",
      );
    }
  }
  return (
    <MessageRow
      reducedMotion={reducedMotion}
      animateEntry={animateEntry}
      className={`paper-message paper-message-assistant${message.blocked ? " paper-message-blocked" : ""}`}
    >
      <BrigidLogo className="paper-assistant-mark" state="reply" />
      <div className="paper-reply">
        {message.blocked && (
          <strong className="paper-blocked-label">
            Reply blocked for safety
          </strong>
        )}
        <div className="paper-message-text">{message.text}</div>
        <div className="paper-reply-actions" aria-label="Reply actions">
          <FutureControl icon="up" label="Helpful" />
          <FutureControl icon="down" label="Not helpful" />
          <FutureControl icon="refresh" label="Regenerate" />
          <button
            className="paper-icon-button"
            type="button"
            aria-label="Copy reply"
            title="Copy reply"
            onClick={() => void copy()}
          >
            <ChatIcon name="copy" />
          </button>
          <span className="paper-coming-soon">
            Feedback & retry: Coming soon
          </span>
        </div>
        <p className="paper-copy-status" role="status">
          {copyStatus}
        </p>
      </div>
    </MessageRow>
  );
}

export function AIAssistantInterface() {
  const pageRef = useRef<HTMLElement>(null);
  const introPlayed = useRef(false);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const autoScrolling = useRef(false);
  const scrollInitialized = useRef(false);
  const focusVersion = useRef(0);
  const {
    info,
    infoError,
    retryInfo,
    role,
    draft,
    setDraft,
    messages,
    sending,
    busy,
    chatNotice,
    composerFocusVersion,
    sendMessage,
  } = useWorkspace();
  const [existingMessageIds] = useState(
    () => new Set(messages.map((message) => message.id)),
  );

  useEffect(() => {
    if (!info || infoError || introPlayed.current) return;
    if (
      reducedMotion ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      introPlayed.current = true;
      return;
    }
    const page = pageRef.current;
    if (!page) return;
    const controls: Array<ReturnType<typeof animate>> = [];
    const finish = () => controls.forEach((control) => control.complete());
    const frame = requestAnimationFrame(() => {
      introPlayed.current = true;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      let cardIndex = 0;
      Array.from(page.querySelectorAll<HTMLElement>("[data-chat-intro]"))
        .filter((element) => element.getClientRects().length > 0)
        .forEach((element) => {
          const part = element.dataset.chatIntro;
          const delay =
            part === "greeting"
              ? 0
              : part === "question"
                ? 0.08
                : part === "prompt"
                  ? 0.16 + cardIndex++ * 0.06
                  : part === "composer"
                    ? 0.4
                    : 0.48;
          controls.push(
            animate(
              element,
              {
                opacity: [0, Number(getComputedStyle(element).opacity)],
                transform: ["translateY(10px)", "translateY(0px)"],
              },
              { duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] },
            ),
          );
        });
      page.addEventListener("focusin", finish);
      page.addEventListener("pointerdown", finish);
    });
    return () => {
      cancelAnimationFrame(frame);
      finish();
      page.removeEventListener("focusin", finish);
      page.removeEventListener("pointerdown", finish);
    };
  }, [info, infoError, reducedMotion]);

  useEffect(() => {
    if (composerFocusVersion === focusVersion.current) return;
    focusVersion.current = composerFocusVersion;
    composerRef.current?.focus({ preventScroll: true });
  }, [composerFocusVersion]);

  useEffect(() => {
    const scroll = scrollRef.current;
    const firstScroll = !scrollInitialized.current;
    scrollInitialized.current = true;
    if (!scroll || !messages.length || !followMessages.current) return;
    const smooth = !reducedMotion && !firstScroll;
    autoScrolling.current = smooth;
    scroll.scrollTo({
      top: scroll.scrollHeight,
      behavior: smooth ? "smooth" : "instant",
    });
    if (scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 2)
      autoScrolling.current = false;
  }, [messages, sending, reducedMotion]);

  function interruptAutoScroll() {
    const scroll = scrollRef.current;
    if (!scroll) return;
    if (autoScrolling.current)
      scroll.scrollTo({ top: scroll.scrollTop, behavior: "instant" });
    autoScrolling.current = false;
    followMessages.current =
      scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 100;
  }

  const handleComposerSubmit = useCallback(() => {
    followMessages.current = true;
    void sendMessage();
  }, [sendMessage]);

  const composerState = useMemo(
    () => ({
      value: draft,
      attachments: [],
      submitting: sending,
      disabled: !role || busy,
      canSubmit: Boolean(role && draft.trim() && !busy),
    }),
    [draft, sending, role, busy],
  );

  const composerActions = useMemo(
    () => ({
      setValue: setDraft,
      addAttachments: () => {},
      removeAttachment: () => {},
      submit: handleComposerSubmit,
    }),
    [setDraft, handleComposerSubmit],
  );

  return (
    <section
      ref={pageRef}
      className={`paper-chat${messages.length ? " paper-chat-active" : ""}`}
      aria-labelledby="chat-title"
    >
      <ChatBackground />
      <div
        ref={scrollRef}
        className="paper-chat-scroll"
        onScroll={(event) => {
          const el = event.currentTarget;
          const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
          if (autoScrolling.current) {
            if (distance < 2) {
              autoScrolling.current = false;
              followMessages.current = true;
            }
            return;
          }
          followMessages.current = distance < 100;
        }}
        onWheel={(event) => {
          if (event.deltaY < 0) interruptAutoScroll();
        }}
        onPointerDown={interruptAutoScroll}
        onTouchStart={interruptAutoScroll}
        onKeyDown={(event) => {
          if (["ArrowUp", "PageUp", "Home"].includes(event.key))
            interruptAutoScroll();
        }}
      >
        {infoError && (
          <div className="paper-chat-state" role="alert">
            <h1 id="chat-title">Unable to connect</h1>
            <p>{infoError}</p>
            <button
              className="button"
              type="button"
              onClick={() => void retryInfo()}
            >
              <ChatIcon name="refresh" />
              Retry connection
            </button>
          </div>
        )}
        {!infoError && !info && (
          <div className="paper-chat-state" role="status">
            <BrigidLogo className="paper-chat-state-mark" state="processing" />
            <h1 id="chat-title">Connecting to Brigid</h1>
            <p>Loading roles and approval requests.</p>
          </div>
        )}
        {info && !infoError && messages.length === 0 && (
          <div className="paper-welcome">
            <h1 id="chat-title">
              <span data-chat-intro="greeting">{"Hello, i'm Brigid"}</span>
              <span data-chat-intro="question">How can I help you today?</span>
            </h1>
            <div className="paper-prompts" aria-label="Suggested prompts">
              {prompts.map((prompt, index) => (
                <PromptCard
                  key={prompt.icon}
                  text={prompt.text}
                  icon={prompt.icon}
                  disabled={!role || busy}
                  meshDelayMs={index * 45}
                  onSelect={() => {
                    setDraft(`${prompt.text}.`);
                    composerRef.current?.focus();
                  }}
                />
              ))}
            </div>
          </div>
        )}
        {messages.length > 0 && (
          <div className="paper-conversation">
            <h1 id="chat-title" className="sr-only">
              Conversation with Brigid
            </h1>
            <ol className="paper-messages" aria-label="Conversation messages">
              {messages.map((message) =>
                message.author === "you" ? (
                  <MessageRow
                    key={message.id}
                    reducedMotion={reducedMotion}
                    animateEntry={!existingMessageIds.has(message.id)}
                    className="paper-message paper-message-user"
                  >
                    <span className="sr-only">You</span>
                    <div className="paper-user-bubble">{message.text}</div>
                  </MessageRow>
                ) : (
                  <AssistantMessage
                    key={message.id}
                    message={message}
                    reducedMotion={reducedMotion}
                    animateEntry={!existingMessageIds.has(message.id)}
                  />
                ),
              )}
              {sending && (
                <MessageRow
                  reducedMotion={reducedMotion}
                  className="paper-message paper-message-assistant"
                  role="status"
                >
                  <BrigidLogo
                    className="paper-assistant-mark"
                    state="processing"
                    decorative
                  />
                  <p className="paper-thinking">
                    Thinking through your request…
                  </p>
                </MessageRow>
              )}
            </ol>
          </div>
        )}
      </div>
      <div className="paper-chat-dock">
        {chatNotice && (
          <div
            className={`notice notice-${chatNotice.tone}`}
            role={chatNotice.tone === "error" ? "alert" : "status"}
          >
            {chatNotice.text}
          </div>
        )}
        <ChatComposerProvider
          state={composerState}
          actions={composerActions}
          inputRef={composerRef}
        >
          <ChatComposerFrame
            className="paper-composer"
            data-chat-intro="composer"
          >
            <label className="sr-only" htmlFor="message-input">
              Message Brigid
            </label>
            <ChatComposerInput
              id="message-input"
              maxLength={4000}
              placeholder="Ask Brigid about your business"
              aria-describedby="composer-instructions"
              onFocus={() => {
                if (window.innerWidth <= 760) {
                  window.scrollTo(0, 0);
                  requestAnimationFrame(() => window.scrollTo(0, 0));
                }
              }}
            />
            <ChatComposerFooter className="paper-composer-toolbar">
              <div className="paper-composer-options">
                {/* TODO: Wire file attachments once backend upload API is ready */}
                <ChatComposerAction
                  label="Attach file, coming soon"
                  title="Attach file: Coming soon"
                  disabled
                  className="paper-future-control paper-icon-button"
                >
                  <Paperclip className="size-4" aria-hidden="true" />
                </ChatComposerAction>
                {/* TODO: Wire tool selector once workspace tools are configurable */}
                <ChatComposerAction
                  label="Tools, coming soon"
                  title="Tools: Coming soon"
                  disabled
                  className="paper-future-control paper-icon-button"
                >
                  <SlidersHorizontal className="size-4" aria-hidden="true" />
                  <span>Tools</span>
                </ChatComposerAction>
                <span className="paper-coming-soon">Coming soon</span>
              </div>
              <div className="paper-composer-options">
                {/* TODO: Wire voice input once speech-to-text is enabled */}
                <ChatComposerAction
                  label="Microphone, coming soon"
                  title="Microphone: Coming soon"
                  disabled
                  className="paper-future-control paper-icon-button"
                >
                  <Mic className="size-4" aria-hidden="true" />
                </ChatComposerAction>
                <ChatComposerSubmit
                  className="paper-send paper-icon-button"
                  aria-label={sending ? "Sending message" : "Send message"}
                  title="Send message"
                />
              </div>
            </ChatComposerFooter>
          </ChatComposerFrame>
        </ChatComposerProvider>
        <p className="paper-disclaimer my-4" data-chat-intro="caption">
          Brigid can make mistakes. Check its answers. Local simulation only.
          Attachments, tools & voice: Coming soon
        </p>
        <div
          id="composer-instructions"
          className="paper-input-hint"
          data-chat-intro="caption"
        >
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>{draft.length.toLocaleString("en-US")}/4,000</span>
        </div>
      </div>
    </section>
  );
}
