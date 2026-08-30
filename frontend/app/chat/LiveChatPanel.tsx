"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { io, type Socket } from "socket.io-client";
import { useTranslations } from "next-intl";
import { CircleAlert, Send, MessageSquareWarning, CircleHelp, Ticket, X } from "lucide-react";
import { API_URL } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createConversation, getMyRecentTickets, type ChatTicketSummary } from "./actions";

interface ChatMessage {
  _id: string;
  text: string;
  senderType: "customer" | "agent" | "ai" | "system";
  createdAt: string;
}

const STATUS_KEY: Record<ChatTicketSummary["status"], string> = {
  new: "statusNew",
  in_progress: "statusInProgress",
  answered: "statusAnswered",
  escalated: "statusEscalated",
  closed: "statusClosed",
};

const STATUS_BADGE_CLASS: Record<ChatTicketSummary["status"], string> = {
  new: "border-transparent bg-muted text-muted-foreground",
  in_progress: "border-transparent bg-warning/10 text-warning",
  answered: "border-transparent bg-success/10 text-success",
  escalated: "border-transparent bg-destructive/10 text-destructive",
  closed: "border-transparent bg-muted text-muted-foreground",
};

type ConnectionStatus = "connecting" | "connected" | "error";
// Story 16/17: orthogonal to ConnectionStatus (socket up/down) — this tracks
// whether the customer has asked to talk to a human, independent of the
// underlying connection ever dropping/reconnecting. "escalated" = waiting
// for Story 17's auto-assign; "assigned" = a human agent has joined.
type EscalationState = "idle" | "requesting" | "escalated" | "assigned";

// Story 14: the access token is passed down once, purely so the Socket.io
// handshake can authenticate (there is no other way for a WebSocket
// connection to carry the httpOnly session cookie) — it is never written to
// localStorage or any client-readable cookie, matching CLAUDE.md's auth
// model everywhere else; it only lives in this component's state for the
// life of the page.
export function LiveChatPanel({ token }: { token: string }) {
  const t = useTranslations("Chat");
  const tt = useTranslations("Tickets");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [aiTyping, setAiTyping] = useState(false);
  const [escalationState, setEscalationState] = useState<EscalationState>("idle");
  // Story 17: shown when escalation finds no online agent — offers the two
  // options (keep chatting with AI, or close) instead of the old
  // email/ticket suggestion.
  const [noAgentAvailable, setNoAgentAvailable] = useState(false);
  const [conversationClosed, setConversationClosed] = useState(false);
  const [previousTicketsOpen, setPreviousTicketsOpen] = useState(false);
  const [previousTicketsLoading, setPreviousTicketsLoading] = useState(false);
  const [previousTickets, setPreviousTickets] = useState<ChatTicketSummary[] | null>(null);
  const [previousTicketsError, setPreviousTicketsError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const aiTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Story 15: independent of the server ever clearing the indicator (the AI
  // reply/fallback message doing so is the normal path) — a server crash
  // between the typing event and the reply would otherwise leave this stuck
  // forever, so it always self-clears after 15s.
  function clearAiTypingTimeout() {
    if (aiTypingTimeoutRef.current) {
      clearTimeout(aiTypingTimeoutRef.current);
      aiTypingTimeoutRef.current = null;
    }
  }

  function startAiTypingSafetyTimeout() {
    clearAiTypingTimeout();
    aiTypingTimeoutRef.current = setTimeout(() => setAiTyping(false), 15_000);
  }

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const result = await createConversation();
      if (cancelled) return;
      if (result.error) {
        setStatus("error");
        setErrorMessage(result.error);
        return;
      }

      conversationIdRef.current = result.id;
      const socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("conversation:join", result.id);
      });
      socket.on("conversation:joined", () => {
        if (!cancelled) setStatus("connected");
      });
      socket.on("conversation:message", (message: ChatMessage) => {
        if (cancelled) return;
        if (message.senderType === "ai") {
          setAiTyping(false);
          clearAiTypingTimeout();
        }
        setMessages((prev) => [...prev, message]);
      });
      socket.on("conversation:ai-typing", () => {
        if (cancelled) return;
        setAiTyping(true);
        startAiTypingSafetyTimeout();
      });
      socket.on("conversation:escalated", () => {
        if (cancelled) return;
        setEscalationState("escalated");
        setAiTyping(false);
        clearAiTypingTimeout();
      });
      socket.on("conversation:assigned", () => {
        if (cancelled) return;
        setEscalationState("assigned");
        setNoAgentAvailable(false);
      });
      socket.on("conversation:no-agent-available", () => {
        if (cancelled) return;
        // Backend already reverted status to ai_handling — reset to "idle"
        // so "Talk to a human" is reachable again once the hint is dismissed.
        setEscalationState("idle");
        setNoAgentAvailable(true);
      });
      socket.on("conversation:closed", () => {
        if (cancelled) return;
        setConversationClosed(true);
        setNoAgentAvailable(false);
      });
      socket.on("conversation:error", (payload: { error: string }) => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(payload.error);
        }
      });
      socket.on("connect_error", () => {
        if (!cancelled) {
          setStatus("error");
          setErrorMessage(t("error"));
        }
      });
    }

    connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
      clearAiTypingTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function sendMessage(text: string) {
    if (!text || !conversationIdRef.current || !socketRef.current) return;
    socketRef.current.emit("conversation:message", { conversationId: conversationIdRef.current, text });
  }

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    sendMessage(text);
    setDraft("");
  }

  // Quick-action chip: Complaint/Inquiry send a fixed intent message
  // immediately (same emit path as the composer's send button) so the
  // customer doesn't have to type it themselves — Story 15's AI branch
  // responds to it exactly like any other customer message.
  function handleIntentChip(text: string) {
    sendMessage(text);
  }

  // Story 16: socket emit only — conversation:message is already the
  // customer's only real-time channel into the conversation, so escalation
  // reuses that same authenticated transport rather than a REST call.
  function handleEscalate() {
    if (!socketRef.current || !conversationIdRef.current) return;
    if (escalationState !== "idle") return;
    setEscalationState("requesting");
    socketRef.current.emit("conversation:escalate", { conversationId: conversationIdRef.current });
  }

  // Story 17: dismiss the no-agent hint — nothing to emit, the backend
  // already reverted status to ai_handling, so the next message the
  // customer sends naturally hits the Story 15 AI branch again.
  function handleKeepChattingWithAi() {
    setNoAgentAvailable(false);
  }

  function handleCloseConversation() {
    if (!socketRef.current || !conversationIdRef.current) return;
    socketRef.current.emit("conversation:close", { conversationId: conversationIdRef.current });
  }

  async function handleTogglePreviousTickets() {
    if (previousTicketsOpen) {
      setPreviousTicketsOpen(false);
      return;
    }
    setPreviousTicketsOpen(true);
    setPreviousTicketsLoading(true);
    setPreviousTicketsError(null);
    const result = await getMyRecentTickets();
    setPreviousTicketsLoading(false);
    if (result.error) {
      setPreviousTicketsError(result.error);
      return;
    }
    setPreviousTickets(result.tickets);
  }

  return (
    <Card className="flex h-[70vh] w-full max-w-lg flex-col">
      <CardHeader>
        <CardTitle>{t("heading")}</CardTitle>
        <CardDescription>
          {status === "connecting" && t("connecting")}
          {status === "connected" && t("connected")}
          {status === "error" && t("error")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {errorMessage && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {escalationState === "escalated" && (
          <Alert>
            <MessageSquareWarning />
            <AlertDescription>{t("escalatedWaiting")}</AlertDescription>
          </Alert>
        )}
        {escalationState === "assigned" && (
          <Alert>
            <MessageSquareWarning />
            <AlertDescription>{t("agentJoined")}</AlertDescription>
          </Alert>
        )}
        {noAgentAvailable && (
          <Alert>
            <MessageSquareWarning />
            <AlertDescription className="flex flex-col gap-2">
              <div>
                <p className="font-medium">{t("noAgentAvailableTitle")}</p>
                <p>{t("noAgentAvailableBody")}</p>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleKeepChattingWithAi}>
                  {t("noAgentKeepChattingAi")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCloseConversation}>
                  {t("noAgentClose")}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {conversationClosed && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{t("closed")}</AlertDescription>
          </Alert>
        )}
        {messages.map((message) => {
          const isCustomer = message.senderType === "customer";
          return (
            <div key={message._id} className={`flex max-w-[80%] flex-col gap-1 ${isCustomer ? "self-end items-end" : "self-start items-start"}`}>
              {/* TODO(story-16/18): label "agent" messages once agent replies land */}
              {message.senderType === "ai" && (
                <span className="text-[11px] font-medium text-muted-foreground">{t("aiAgentLabel")}</span>
              )}
              <div className={`rounded-xl px-3 py-2 text-sm ${isCustomer ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {message.text}
              </div>
              <span dir="ltr" className="text-[11px] text-muted-foreground">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
          );
        })}
        {aiTyping && (
          <div className="flex max-w-[80%] flex-col gap-1 self-start items-start">
            <span className="text-[11px] font-medium text-muted-foreground">{t("aiAgentLabel")}</span>
            <div className="rounded-xl bg-muted px-3 py-2 text-sm italic text-muted-foreground">
              {t("aiTyping")}
            </div>
          </div>
        )}
        {previousTicketsOpen && (
          <div className="flex w-full max-w-[90%] flex-col gap-2 self-start rounded-xl border border-border bg-card p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{t("previousTicketsHeading")}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => setPreviousTicketsOpen(false)}
              >
                <X className="size-3.5" />
                <span className="sr-only">{t("previousTicketsClose")}</span>
              </Button>
            </div>
            {previousTicketsLoading && <p className="text-muted-foreground">{t("connecting")}</p>}
            {previousTicketsError && <p className="text-destructive">{previousTicketsError}</p>}
            {!previousTicketsLoading && !previousTicketsError && previousTickets?.length === 0 && (
              <p className="text-muted-foreground">{t("previousTicketsEmpty")}</p>
            )}
            {!previousTicketsLoading &&
              previousTickets?.map((ticket) => (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border p-2 hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate font-medium">{ticket.subject}</span>
                    <span className="font-mono text-xs text-muted-foreground">{ticket.reference}</span>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant="outline" className={STATUS_BADGE_CLASS[ticket.status]}>
                      {tt(STATUS_KEY[ticket.status])}
                    </Badge>
                    <span dir="ltr" className="text-[11px] text-muted-foreground">
                      {formatDateTime(ticket.updatedAt)}
                    </span>
                  </div>
                </Link>
              ))}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t-0 bg-transparent pt-1">
        <div className="flex w-full flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "connected" || conversationClosed}
            onClick={() => handleIntentChip(t("complaintMessage"))}
          >
            <MessageSquareWarning className="size-3.5" />
            {t("complaintChip")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "connected" || conversationClosed}
            onClick={() => handleIntentChip(t("inquiryMessage"))}
          >
            <CircleHelp className="size-3.5" />
            {t("inquiryChip")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={status !== "connected"}
            onClick={handleTogglePreviousTickets}
          >
            <Ticket className="size-3.5" />
            {t("previousTicketsChip")}
          </Button>
          {(escalationState === "idle" || escalationState === "requesting") && !conversationClosed && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={status !== "connected" || escalationState === "requesting"}
              onClick={handleEscalate}
            >
              <MessageSquareWarning className="size-3.5" />
              {escalationState === "requesting" ? t("talkToHumanRequesting") : t("talkToHuman")}
            </Button>
          )}
        </div>
        <div className="flex w-full items-center gap-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t("composerPlaceholder")}
            rows={1}
            disabled={status !== "connected" || conversationClosed}
            className="min-h-9"
          />
          <Button
            type="button"
            size="icon"
            disabled={status !== "connected" || conversationClosed || draft.trim().length === 0}
            onClick={handleSend}
          >
            <Send className="size-4" />
            <span className="sr-only">{t("send")}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
