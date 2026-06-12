import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MessagesSquare, Send } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { WhatsAppButton } from "./WhatsAppButton";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useNotifyClient } from "@/components/project/NotifyClient";
import type { Message } from "@/types/database";

export function InternalChat({
  projectId,
  projectTitle,
  senderId,
  isAdmin = false,
}: {
  projectId: string;
  projectTitle: string;
  senderId: string | null;
  isAdmin?: boolean;
}) {
  const qc = useQueryClient();
  const { requestNotify } = useNotifyClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const { data: messages, isLoading } = useQuery({
    queryKey: ["messages", projectId],
    queryFn: async (): Promise<Message[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel(`messages:${projectId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
          filter: `project_id=eq.${projectId}`,
        },
        () => qc.invalidateQueries({ queryKey: ["messages", projectId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, qc]);

  // Keep the chat pinned to the latest message by scrolling the list itself -
  // NOT scrollIntoView, which would scroll the whole project page down on open.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages?.length]);

  async function send() {
    const content = clampText(text.trim(), 2000);
    if (!content || !senderId) return;
    setSending(true);
    const { error } = await supabase
      .from("messages")
      .insert({ project_id: projectId, sender_id: senderId, content });
    setSending(false);
    if (error) return toastError("שליחת ההודעה נכשלה.");
    if (isAdmin) {
      requestNotify({
        type: "message",
        title: "הודעה חדשה מהסטודיו",
        body: content,
      });
    }
    setText("");
  }

  return (
    <Card className="flex h-[28rem] flex-col p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MessagesSquare className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            צ'אט פנימי
          </h2>
        </div>
        <WhatsAppButton projectTitle={projectTitle} />
      </div>

      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto pe-1">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-2/3 rounded-xl" />
            ))}
          </div>
        ) : !messages?.length ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            עדיין אין הודעות. כתוב את הראשונה 👋
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === senderId;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: mine ? -12 : 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className={cn("flex", mine ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3 py-2 text-sm",
                    mine
                      ? "bg-primary/15 text-foreground"
                      : "bg-background/50 text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                  <p className="mt-1 text-[10px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString("he-IL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Input
          placeholder="כתוב הודעה…"
          maxLength={2000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button size="icon" onClick={send} disabled={sending} aria-label="שליחה">
          <Send className="size-4" />
        </Button>
      </div>
    </Card>
  );
}
