"use client";

import {
  Suspense,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  type BrigidInfo,
  type ChatResult,
  type DecisionResult,
  type PendingRequest,
  type Role,
  type UserSession,
  brigidGet,
  brigidLogin,
  brigidLogout,
  brigidMe,
  brigidPost,
} from "@/lib/brigid-api";
import { decisionTone } from "@/lib/decision-tone";

export type Message = {
  id: number;
  author: "you" | "brigid";
  text: string;
  blocked?: boolean;
};
export type Notice = { tone: "success" | "error"; text: string };
export type QueueState = "loading" | "ready" | "error";

type WorkspaceContextValue = {
  info: BrigidInfo | null;
  infoError: string;
  user: UserSession | null;
  sessionChecked: boolean;
  role: Role | "";
  draft: string;
  setDraft: (text: string) => void;
  messages: Message[];
  sending: boolean;
  resetting: boolean;
  mandating: boolean;
  processingId: string;
  busy: boolean;
  requests: PendingRequest[];
  queueState: QueueState;
  queueError: string;
  chatNotice: Notice | null;
  queueNotice: Notice | null;
  mandateNotice: Notice | null;
  composerFocusVersion: number;
  changeRole: (role: Role) => void;
  signIn: (email: string, password: string) => Promise<UserSession>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  retryInfo: () => Promise<void>;
  retryPending: () => Promise<void>;
  sendMessage: () => Promise<void>;
  resetConversation: () => Promise<boolean>;
  draftMandate: () => Promise<void>;
  decide: (
    request: PendingRequest,
    action: "confirm" | "cancel",
  ) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function errorText(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please retry.";
}

function SearchPromptSync({
  onPrompt,
}: {
  onPrompt: (text: string) => void;
}) {
  const searchParams = useSearchParams();
  const promptParam = (searchParams.get("prompt") ?? "").trim().slice(0, 4000);
  const lastPromptRef = useRef("");
  useEffect(() => {
    if (promptParam && promptParam !== lastPromptRef.current) {
      lastPromptRef.current = promptParam;
      onPrompt(promptParam);
    }
  }, [promptParam, onPrompt]);
  return null;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const nextMessageId = useRef(0);
  const pendingGeneration = useRef(0);
  const prefetchedOwnerPending = useRef(false);
  const [info, setInfo] = useState<BrigidInfo | null>(null);
  const [infoError, setInfoError] = useState("");
  const [user, setUser] = useState<UserSession | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [role, setRole] = useState<Role | "">("");
  // The landing footer opens Chat with ?prompt=...: seed the composer draft as plain
  // text only. Nothing is sent automatically, and the value is capped at the composer
  // maximum because maxLength does not apply to programmatic values.
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [mandating, setMandating] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [queueState, setQueueState] = useState<QueueState>("loading");
  const [queueError, setQueueError] = useState("");
  const [chatNotice, setChatNotice] = useState<Notice | null>(null);
  const [queueNotice, setQueueNotice] = useState<Notice | null>(null);
  const [mandateNotice, setMandateNotice] = useState<Notice | null>(null);
  const [composerFocusVersion, setComposerFocusVersion] = useState(0);

  const loadPending = useCallback(async (currentRole: Role) => {
    const generation = ++pendingGeneration.current;
    try {
      const result = await brigidGet<{ requests: PendingRequest[] }>(
        "pending",
        currentRole,
      );
      if (generation !== pendingGeneration.current) return;
      setRequests(result.requests);
      setQueueError("");
      setQueueState("ready");
    } catch (error) {
      if (generation !== pendingGeneration.current) return;
      setQueueError(errorText(error));
      setQueueState("error");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const isOAuthReturn =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("oauth") === "1";
    if (isOAuthReturn && typeof window !== "undefined") {
      window.sessionStorage.setItem("brigid_has_session", "1");
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }
    const hasSession =
      typeof window !== "undefined" &&
      window.sessionStorage.getItem("brigid_has_session") === "1";
    const mePromise = hasSession ? brigidMe() : Promise.resolve(null);
    const ownerPendingPromise = brigidGet<{ requests: PendingRequest[] }>(
      "pending",
      "owner",
    );
    void Promise.allSettled([
      brigidGet<BrigidInfo>("info"),
      mePromise,
      ownerPendingPromise,
    ]).then(([infoResult, meResult, ownerPendingResult]) => {
      if (!active) return;
      const signedUser =
        meResult.status === "fulfilled" ? meResult.value : null;
      if (hasSession && !signedUser && typeof window !== "undefined") {
        window.sessionStorage.removeItem("brigid_has_session");
      }
      setUser(signedUser);
      setSessionChecked(true);
      let resolvedRole: Role | "" = "";
      if (infoResult.status === "fulfilled") {
        setInfo(infoResult.value);
        resolvedRole = signedUser?.role ?? infoResult.value.roles[0] ?? "";
      } else {
        setInfoError(errorText(infoResult.reason));
        if (signedUser) resolvedRole = signedUser.role;
      }
      if (
        resolvedRole === "owner" &&
        ownerPendingResult.status === "fulfilled"
      ) {
        prefetchedOwnerPending.current = true;
        setRequests(ownerPendingResult.value.requests);
        setQueueError("");
        setQueueState("ready");
      }
      setRole(resolvedRole);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!role) return;
    if (role === "owner" && prefetchedOwnerPending.current) {
      prefetchedOwnerPending.current = false;
      return;
    }
    const generation = ++pendingGeneration.current;
    void brigidGet<{ requests: PendingRequest[] }>("pending", role)
      .then((result) => {
        if (generation !== pendingGeneration.current) return;
        setRequests(result.requests);
        setQueueState("ready");
      })
      .catch((error: unknown) => {
        if (generation !== pendingGeneration.current) return;
        setQueueError(errorText(error));
        setQueueState("error");
      });
    return () => {
      pendingGeneration.current += 1;
    };
  }, [role]);

  async function retryInfo() {
    setInfoError("");
    try {
      const result = await brigidGet<BrigidInfo>("info");
      setInfo(result);
      setRole((current) =>
        current && result.roles.includes(current)
          ? current
          : (result.roles[0] ?? ""),
      );
    } catch (error) {
      setInfoError(errorText(error));
    }
  }

  async function retryPending() {
    if (!role) return;
    setQueueState("loading");
    await loadPending(role);
  }

  function changeRole(nextRole: Role) {
    if (nextRole === role) return;
    pendingGeneration.current += 1;
    setRole(nextRole);
    setQueueState("loading");
    setRequests([]);
    setMessages([]);
    setDraft("");
    setChatNotice(null);
    setQueueNotice(null);
    setMandateNotice(null);
  }

  async function sendMessage() {
    const text = draft.trim();
    if (
      !role ||
      !text ||
      sending ||
      resetting ||
      mandating ||
      processingId ||
      text.length > 4000
    )
      return;
    setSending(true);
    setChatNotice(null);
    setDraft("");
    const submittedId = ++nextMessageId.current;
    setMessages((items) => [
      ...items,
      { id: submittedId, author: "you", text },
    ]);
    try {
      const result = await brigidPost<ChatResult>("chat", { role, text });
      setMessages((items) => [
        ...items,
        {
          id: ++nextMessageId.current,
          author: "brigid",
          text: result.reply,
          blocked: result.blocked,
        },
      ]);
      if (result.new_requests.length > 0) {
        const count = result.new_requests.length;
        setChatNotice({
          tone: "success",
          text: `${count} new approval ${count === 1 ? "request" : "requests"} added.`,
        });
      }
      await loadPending(role);
    } catch (error) {
      setMessages((items) => items.filter((item) => item.id !== submittedId));
      setDraft(text);
      setChatNotice({
        tone: "error",
        text: `Message not completed. ${errorText(error)}`,
      });
    } finally {
      setSending(false);
      setComposerFocusVersion((value) => value + 1);
    }
  }

  async function resetConversation(): Promise<boolean> {
    if (!role || sending || resetting || mandating || processingId)
      return false;
    setResetting(true);
    setChatNotice(null);
    try {
      await brigidPost<{ status: string }>("reset", { role });
      setMessages([]);
      setDraft("");
      setChatNotice({
        tone: "success",
        text: "Conversation reset for this role.",
      });
      await loadPending(role);
      setComposerFocusVersion((value) => value + 1);
      return true;
    } catch (error) {
      setChatNotice({
        tone: "error",
        text: `Could not reset conversation. ${errorText(error)}`,
      });
      return false;
    } finally {
      setResetting(false);
    }
  }

  async function draftMandate() {
    if (role !== "owner" || sending || resetting || mandating || processingId)
      return;
    setMandating(true);
    setMandateNotice(null);
    try {
      const result = await brigidPost<DecisionResult>("mandate", { role });
      setMandateNotice({
        tone: decisionTone(result.status, ["needs_confirmation"]),
        text: result.message,
      });
      await loadPending(role);
    } catch (error) {
      setMandateNotice({
        tone: "error",
        text: `Mandate draft failed. ${errorText(error)}`,
      });
    } finally {
      setMandating(false);
    }
  }

  async function decide(request: PendingRequest, action: "confirm" | "cancel") {
    if (!role || sending || resetting || mandating || processingId) return;
    setProcessingId(request.subject_id);
    setQueueNotice(null);
    try {
      const result = await brigidPost<DecisionResult>(action, {
        role,
        subject_id: request.subject_id,
      });
      setQueueNotice({
        tone: decisionTone(result.status, ["executed", "declined", "active"]),
        text: result.message,
      });
      await loadPending(role);
    } catch (error) {
      setQueueNotice({
        tone: "error",
        text: `${action === "confirm" ? "Confirm" : "Decline"} failed. ${errorText(error)}`,
      });
    } finally {
      setProcessingId("");
    }
  }

  async function signIn(email: string, password: string): Promise<UserSession> {
    const result = await brigidLogin(email, password);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem("brigid_has_session", "1");
    }
    setUser(result.user);
    setSessionChecked(true);
    pendingGeneration.current += 1;
    setRole(result.user.role);
    setQueueState("loading");
    setRequests([]);
    setMessages([]);
    setChatNotice(null);
    setQueueNotice(null);
    setMandateNotice(null);
    return result.user;
  }

  async function signOut(): Promise<void> {
    await brigidLogout();
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem("brigid_has_session");
    }
    setUser(null);
    setSessionChecked(true);
    pendingGeneration.current += 1;
    setRole(info?.roles[0] ?? "");
    setQueueState("loading");
    setRequests([]);
    setMessages([]);
    setChatNotice(null);
    setQueueNotice(null);
    setMandateNotice(null);
  }

  async function refreshSession(): Promise<void> {
    try {
      const me = await brigidMe();
      setUser(me);
      setRole(me.role);
    } catch {
      setUser(null);
    } finally {
      setSessionChecked(true);
    }
  }

  const busy = sending || resetting || mandating || Boolean(processingId);

  return (
    <WorkspaceContext.Provider
      value={{
        info,
        infoError,
        user,
        sessionChecked,
        role,
        draft,
        setDraft,
        messages,
        sending,
        resetting,
        mandating,
        processingId,
        busy,
        requests,
        queueState,
        queueError,
        chatNotice,
        queueNotice,
        mandateNotice,
        composerFocusVersion,
        changeRole,
        signIn,
        signOut,
        refreshSession,
        retryInfo,
        retryPending,
        sendMessage,
        resetConversation,
        draftMandate,
        decide,
      }}
    >
      <Suspense fallback={null}>
        <SearchPromptSync onPrompt={setDraft} />
      </Suspense>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Brigid workspace is missing its provider.");
  return context;
}
