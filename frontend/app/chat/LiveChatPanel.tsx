"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useTranslations } from "next-intl";
import { CircleAlert, Send } from "lucide-react";
import { API_URL } from "@/lib/auth";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createConversation } from "./actions";

interface ChatMessage {
  _id: string;
  text: string;
  senderType: "customer" | "agent" | "ai" | "system";
  createdAt: string;
}

type ConnectionStatus = "connecting" | "connected" | "error";

// Story 14: the access token is passed down once, purely so the Socket.io
// handshake can authenticate (there is no other way for a WebSocket
// connection to carry the httpOnly session cookie) — it is never written to
// localStorage or any client-readable cookie, matching CLAUDE.md's auth
// model everywhere else; it only lives in this component's state for the
// life of the page.
export function LiveChatPanel({ token }: { token: string }) {
  const t = useTranslations("Chat");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

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
        if (!cancelled) setMessages((prev) => [...prev, message]);
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
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function handleSend() {
    const text = draft.trim();
    if (!text || !conversationIdRef.current || !socketRef.current) return;
    socketRef.current.emit("conversation:message", { conversationId: conversationIdRef.current, text });
    setDraft("");
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
        {messages.map((message) => {
          const isCustomer = message.senderType === "customer";
          return (
            <div key={message._id} className={`flex max-w-[80%] flex-col gap-1 ${isCustomer ? "self-end items-end" : "self-start items-start"}`}>
              <div className={`rounded-xl px-3 py-2 text-sm ${isCustomer ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                {message.text}
              </div>
              <span dir="ltr" className="text-[11px] text-muted-foreground">
                {new Date(message.createdAt).toLocaleString()}
              </span>
            </div>
          );
        })}
      </CardContent>
      <CardFooter className="flex items-center gap-2 border-t-0 bg-transparent pt-1">
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
          disabled={status !== "connected"}
          className="min-h-9"
        />
        <Button type="button" size="icon" disabled={status !== "connected" || draft.trim().length === 0} onClick={handleSend}>
          <Send className="size-4" />
          <span className="sr-only">{t("send")}</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
