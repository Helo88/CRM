"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useTranslations } from "next-intl";
import { Send, CircleAlert } from "lucide-react";
import { API_URL } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

export interface AgentChatMessage {
  _id: string;
  text: string;
  senderType: "customer" | "agent" | "ai" | "system";
  senderId: string | null;
  createdAt: string;
}

type ConversationStatus = "ai_handling" | "escalated" | "with_agent" | "resolved";
type ConnectionStatus = "connecting" | "connected" | "error";

// Story 18: minimal agent/admin reply surface — deliberately not a copy of
// LiveChatPanel.tsx (customer-scoped: different auth redirects, different
// composer affordances). Story 20's unified dashboard is the right place to
// consolidate shared chat-rendering code, not this story.
export function AgentChatPanel({
  conversationId,
  initialStatus,
  initialMessages,
  token,
  currentUserId,
}: {
  conversationId: string;
  initialStatus: ConversationStatus;
  initialMessages: AgentChatMessage[];
  token: string;
  currentUserId?: string;
}) {
  const t = useTranslations("AgentChats");
  const [messages, setMessages] = useState<AgentChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>(initialStatus);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let cancelled = false;
    const socket = io(API_URL, { auth: { token }, transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("conversation:join", conversationId);
    });
    socket.on("conversation:joined", () => {
      if (!cancelled) setStatus("connected");
    });
    socket.on("conversation:message", (message: AgentChatMessage) => {
      if (cancelled) return;
      setMessages((prev) => [...prev, message]);
    });
    // Forward-compatible with Story 19 ("close a live chat"), which adds the
    // actual "mark resolved" control — this just reflects the status
    // change if it happens while the agent is looking at this page.
    // TODO(Story 19): mark-resolved button goes in the header row below.
    socket.on("conversation:closed", () => {
      if (!cancelled) setConversationStatus("resolved");
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
        setErrorMessage(t("connectionError"));
      }
    });

    return () => {
      cancelled = true;
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, token]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit("conversation:message", { conversationId, text });
    setDraft("");
  }

  const isClosed = conversationStatus === "resolved";
  const isDisabled = status !== "connected" || isClosed;

  return (
    <Card className="flex h-[70vh] w-full max-w-lg flex-col">
      <CardHeader>
        <CardTitle>{t("detailHeading")}</CardTitle>
        <CardDescription>
          {status === "connecting" && t("connecting")}
          {status === "connected" && !isClosed && t("connected")}
          {status === "connected" && isClosed && t("closed")}
          {status === "error" && t("connectionError")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-2 overflow-y-auto">
        {errorMessage && (
          <Alert variant="destructive">
            <CircleAlert />
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        )}
        {messages.map((message) => {
          const isOwnMessage = message.senderId === currentUserId;
          return (
            <div
              key={message._id}
              className={`flex max-w-[80%] flex-col gap-1 ${isOwnMessage ? "self-end items-end" : "self-start items-start"}`}
            >
              <span className="text-[11px] font-medium text-muted-foreground">
                {message.senderType === "ai"
                  ? t("aiAgentLabel")
                  : message.senderType === "customer"
                    ? t("customerLabel")
                    : isOwnMessage
                      ? t("youLabel")
                      : t("agentLabel")}
              </span>
              <div
                className={`rounded-xl px-3 py-2 text-sm ${isOwnMessage ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              >
                {message.text}
              </div>
              <span dir="ltr" className="text-[11px] text-muted-foreground">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
          );
        })}
      </CardContent>
      <CardFooter className="flex flex-col gap-2 border-t-0 bg-transparent pt-1">
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
            placeholder={isClosed ? t("closed") : t("composerPlaceholder")}
            rows={1}
            disabled={isDisabled}
            className="min-h-9"
          />
          <Button type="button" size="icon" disabled={isDisabled || draft.trim().length === 0} onClick={handleSend}>
            <Send className="size-4" />
            <span className="sr-only">{t("send")}</span>
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
