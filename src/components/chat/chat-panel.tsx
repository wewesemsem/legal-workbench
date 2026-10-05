"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Conversation = {
  id: string;
  title: string;
  updatedAt: string | Date;
};

type Message = {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string | Date;
};

type DocumentMeta = {
  id: string;
  originalFilename: string;
  processingStatus: string;
};

export function ChatPanel({
  matterId,
  matterName,
  initialConversations,
  initialConversationId,
  initialMessages,
  documents,
}: {
  matterId: string;
  matterName: string;
  initialConversations: Conversation[];
  initialConversationId: string | null;
  initialMessages: Message[];
  documents: DocumentMeta[];
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(initialConversationId);
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === activeId) ?? null,
    [conversations, activeId],
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function createConversation() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/matters/${matterId}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to create conversation");
      }
      router.push(`/app/matters/${matterId}/chat/${data.conversation.id}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create conversation",
      );
    } finally {
      setCreating(false);
    }
  }

  async function onSend(event: FormEvent) {
    event.preventDefault();
    if (!activeId || pending) {
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setPending(true);
    setError(null);
    setContent("");

    const optimisticId = `temp-${crypto.randomUUID()}`;
    setMessages((current) => [
      ...current,
      {
        id: optimisticId,
        role: "USER",
        content: trimmed,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const response = await fetch(`/api/conversations/${activeId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message ?? "Unable to send message");
      }

      setMessages((current) => {
        const withoutOptimistic = current.filter(
          (message) => message.id !== optimisticId,
        );
        return [
          ...withoutOptimistic,
          data.userMessage,
          data.assistantMessage,
        ];
      });
      setConversations((current) =>
        current.map((conversation) =>
          conversation.id === activeId
            ? {
                ...conversation,
                title:
                  conversation.title === "New conversation"
                    ? trimmed.slice(0, 80)
                    : conversation.title,
                updatedAt: new Date().toISOString(),
              }
            : conversation,
        ),
      );
      router.refresh();
    } catch (err) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId),
      );
      setContent(trimmed);
      setError(err instanceof Error ? err.message : "Unable to send message");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)_220px]">
      <aside className="rounded-xl border border-stone-200 bg-[var(--panel)] p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-medium text-stone-900">Conversations</h2>
          <button
            type="button"
            onClick={createConversation}
            disabled={creating}
            className="rounded-md bg-stone-900 px-2 py-1 text-xs font-medium text-white hover:bg-stone-800 disabled:opacity-60"
          >
            {creating ? "…" : "New"}
          </button>
        </div>

        {conversations.length ? (
          <ul className="mt-3 space-y-1">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveId(conversation.id);
                    router.push(
                      `/app/matters/${matterId}/chat/${conversation.id}`,
                    );
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    conversation.id === activeId
                      ? "bg-stone-900 text-white"
                      : "text-stone-800 hover:bg-stone-100"
                  }`}
                >
                  <span className="line-clamp-2">{conversation.title}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-600">
            No conversations yet. Start a conversation about this matter.
          </p>
        )}
      </aside>

      <section className="flex min-h-[520px] flex-col rounded-xl border border-stone-200 bg-[var(--panel)] shadow-sm">
        <header className="border-b border-stone-200 px-5 py-4">
          <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
            Matter: {matterName}
          </p>
          <h1 className="mt-1 text-xl font-semibold text-stone-900">
            {activeConversation?.title ?? "Chat"}
          </h1>
          <p className="mt-1 text-sm text-stone-600">
            Matter-aware assistant. Document contents are not retrieved until
            Matter RAG is enabled.
          </p>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {!activeId ? (
            <div className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-600">
              No conversations yet. Start a conversation about this matter.
            </div>
          ) : messages.length === 0 && !pending ? (
            <div className="rounded-md border border-dashed border-stone-300 bg-white px-4 py-8 text-center text-sm text-stone-600">
              Ask a question about this matter. The assistant only uses
              authorized matter context and this conversation.
            </div>
          ) : (
            messages.map((message) => (
              <article
                key={message.id}
                className={`rounded-md px-4 py-3 text-sm leading-6 ${
                  message.role === "USER"
                    ? "ml-8 bg-stone-900 text-white"
                    : "mr-8 border border-stone-200 bg-white text-stone-800"
                }`}
              >
                <p className="mb-1 text-[11px] uppercase tracking-wide opacity-70">
                  {message.role === "USER" ? "You" : "AI"}
                </p>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </article>
            ))
          )}
          {pending ? (
            <div className="mr-8 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
              Thinking…
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={onSend}
          className="border-t border-stone-200 px-5 py-4"
        >
          {error ? (
            <p className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-stone-700">Message</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              disabled={!activeId || pending}
              placeholder={
                activeId
                  ? "Ask about this matter…"
                  : "Create a conversation to begin"
              }
              className="auth-input"
            />
          </label>
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={!activeId || pending || !content.trim()}
              className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-800 disabled:opacity-60"
            >
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </section>

      <aside className="rounded-xl border border-stone-200 bg-[var(--panel)] p-4 shadow-sm">
        <h2 className="text-sm font-medium text-stone-900">Matter Documents</h2>
        <p className="mt-1 text-xs text-stone-500">
          Listed for awareness only. The model has not read these unless their
          content is later retrieved.
        </p>
        {documents.length ? (
          <ul className="mt-3 space-y-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="rounded-md border border-stone-200 bg-white px-3 py-2 text-xs text-stone-700"
              >
                <p className="font-medium text-stone-900">
                  {document.originalFilename}
                </p>
                <p className="mt-0.5 text-stone-500">
                  {document.processingStatus}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-stone-600">No documents uploaded.</p>
        )}
      </aside>
    </div>
  );
}
