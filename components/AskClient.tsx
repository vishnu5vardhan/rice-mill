"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, ChevronDown, ClipboardList, ExternalLink, Loader2, Send, User } from "lucide-react";

const questions = [
  "What came today?",
  "Which entries are incomplete?",
  "Which truck sheets are missing?",
  "Which lot has mismatch?",
  "How much confirmed stock exists?",
  "What by-products were sold?",
  "Which sale rate looks low?",
  "What expenses are recorded this month?",
  "What data can be sent to CA?"
];

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: string;
  evidence?: unknown;
  missingData?: unknown;
  suggestedActions?: ChatActionSuggestion[];
};

type ChatActionSuggestion = {
  id: string;
  kind: string;
  label: string;
  description: string;
  target: {
    type: "expense" | "draft";
    id: string;
    title: string;
    status?: string;
    href?: string;
  };
  input: {
    kind: string;
    target_id: string;
    product_type?: string;
    reason?: string;
  };
  safety_note: string;
};

export function AskClient() {
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionState, setActionState] = useState<Record<string, "applying" | "applied">>({});
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  async function submit(nextQuestion = question) {
    const trimmedQuestion = nextQuestion.trim();
    if (!trimmedQuestion || loading) return;

    const history = messages.map((message) => ({ role: message.role, content: message.content }));
    const userMessage = { role: "user" as const, content: trimmedQuestion };

    setLoading(true);
    setError(null);
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: trimmedQuestion, history })
      });
      const text = await response.text();
      const json = text ? JSON.parse(text) : null;

      if (!response.ok) {
        setError(json?.error ?? "Question failed. Please try again.");
        return;
      }

      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: json.answer,
          intent: json.intent,
          confidence: json.confidence,
          evidence: json.evidence,
          missingData: json.missing_data,
          suggestedActions: Array.isArray(json.suggested_actions) ? json.suggested_actions : []
        }
      ]);
      setQuestion("");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Assistant could not answer right now.");
    } finally {
      setLoading(false);
    }
  }

  async function applyAction(action: ChatActionSuggestion) {
    if (actionState[action.id] === "applying" || actionState[action.id] === "applied") return;
    setActionState((current) => ({ ...current, [action.id]: "applying" }));
    setError(null);

    try {
      const response = await fetch("/api/ask/action", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: action.input })
      });
      const text = await response.text();
      const json = text ? JSON.parse(text) : null;

      if (!response.ok) {
        setError(json?.error ?? "Could not apply action.");
        setActionState((current) => {
          const next = { ...current };
          delete next[action.id];
          return next;
        });
        return;
      }

      setActionState((current) => ({ ...current, [action.id]: "applied" }));
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${json?.message ?? "Action applied."}${json?.href ? ` Open: ${json.href}` : ""}`,
          confidence: "high",
          evidence: { action_result: json }
        }
      ]);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not apply action.");
      setActionState((current) => {
        const next = { ...current };
        delete next[action.id];
        return next;
      });
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit();
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-190px)] min-h-[620px] max-w-5xl flex-col overflow-hidden rounded-lg border border-ink/10 bg-white shadow-soft">
      <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
        <div>
          <p className="text-sm font-bold text-ink">Mill Assistant</p>
          <p className="text-xs font-medium text-ink/55">Answers from current rice mill data</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-leaf/15 bg-leaf/5 px-3 py-1 text-xs font-bold uppercase text-leaf">
          <span className="h-2 w-2 rounded-full bg-leaf" />
          Evidence on
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#fbfaf7] px-3 py-5 sm:px-6">
        {messages.length === 0 ? (
          <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-leaf text-white">
              <Bot className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-2xl font-bold text-ink">Ask anything about the mill</h2>
            <p className="mt-2 max-w-xl text-sm font-medium leading-6 text-ink/60">
              Check arrivals, incomplete entries, stock, sales, expenses, CA exports, and operational gaps.
            </p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {questions.slice(0, 4).map((item) => (
                <PromptButton key={item} label={item} loading={loading} onClick={() => void submit(item)} />
              ))}
            </div>
          </div>
        ) : (
          <section className="mx-auto max-w-3xl space-y-6">
            {messages.map((message, index) => (
              <MessageBubble
                key={`${message.role}-${index}`}
                message={message}
                actionState={actionState}
                onApplyAction={applyAction}
              />
            ))}
            {loading ? (
              <div className="flex items-start gap-3">
                <Avatar role="assistant" />
                <div className="rounded-lg border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-ink/60 shadow-sm">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin text-leaf" />
                  Checking evidence...
                </div>
              </div>
            ) : null}
            <div ref={messagesEndRef} />
          </section>
        )}
      </div>

      {messages.length > 0 ? (
        <div className="border-t border-ink/10 bg-white px-3 py-3 sm:px-6">
          <div className="mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-2">
            {questions.slice(0, 5).map((item) => (
              <PromptButton key={item} label={item} loading={loading} compact onClick={() => void submit(item)} />
            ))}
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="border-t border-rust/15 bg-rust/10 px-4 py-3 text-sm font-semibold text-rust">
          {error}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="border-t border-ink/10 bg-white p-3 sm:p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-ink/15 bg-field p-2 shadow-sm focus-within:border-leaf/60 focus-within:ring-2 focus-within:ring-leaf/10">
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={1}
            placeholder="Ask about paddy, stock, sales, expenses, documents..."
            className="max-h-32 min-h-11 flex-1 resize-none border-0 bg-transparent px-2 py-3 text-sm font-semibold leading-5 outline-none placeholder:text-ink/40"
          />
          <button
            type="submit"
            aria-label="Send question"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-leaf text-white transition hover:bg-leaf/90 disabled:cursor-wait disabled:opacity-50"
            disabled={loading || !question.trim()}
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </button>
        </div>
      </form>
    </div>
  );
}

function PromptButton({
  label,
  loading,
  compact = false,
  onClick
}: {
  label: string;
  loading: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`shrink-0 rounded-md border border-ink/10 bg-white text-left text-sm font-semibold text-ink shadow-sm transition hover:border-leaf/30 hover:bg-leaf/5 disabled:cursor-wait disabled:opacity-60 ${
        compact ? "px-3 py-2" : "px-4 py-3"
      }`}
    >
      {label}
    </button>
  );
}

function MessageBubble({
  message,
  actionState,
  onApplyAction
}: {
  message: ChatMessage;
  actionState: Record<string, "applying" | "applied">;
  onApplyAction: (action: ChatActionSuggestion) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex items-start gap-3 ${isUser ? "justify-end" : ""}`}>
      {!isUser ? <Avatar role="assistant" /> : null}
      <div className={`max-w-[85%] ${isUser ? "items-end" : "items-start"} flex flex-col`}>
        <div
          className={`rounded-lg px-4 py-3 text-sm leading-6 shadow-sm ${
            isUser
              ? "bg-leaf text-white"
              : "border border-ink/10 bg-white text-ink"
          }`}
        >
          <p className="whitespace-pre-wrap font-semibold">{message.content}</p>
        </div>
        {!isUser && (message.intent || message.confidence || message.evidence) ? (
          <details className="group mt-2 w-full rounded-md border border-ink/10 bg-white px-3 py-2 text-xs text-ink/65">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-bold">
              <span className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-leaf" />
                Evidence
                {message.confidence ? <span className="uppercase text-leaf">{message.confidence}</span> : null}
              </span>
              <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
            </summary>
            <div className="mt-3 border-t border-ink/10 pt-3">
              {message.intent ? <p className="mb-2 text-[11px] font-bold uppercase text-ink/45">{message.intent}</p> : null}
              <EvidenceSummary evidence={message.evidence} missingData={message.missingData} />
              <details className="mt-3 rounded-md bg-field p-3">
                <summary className="cursor-pointer font-bold">Raw evidence</summary>
                <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap">{JSON.stringify(message.evidence, null, 2)}</pre>
              </details>
            </div>
          </details>
        ) : null}
        {!isUser && message.suggestedActions?.length ? (
          <ActionSuggestions
            actions={message.suggestedActions}
            actionState={actionState}
            onApplyAction={onApplyAction}
          />
        ) : null}
      </div>
      {isUser ? <Avatar role="user" /> : null}
    </div>
  );
}

function ActionSuggestions({
  actions,
  actionState,
  onApplyAction
}: {
  actions: ChatActionSuggestion[];
  actionState: Record<string, "applying" | "applied">;
  onApplyAction: (action: ChatActionSuggestion) => void;
}) {
  return (
    <div className="mt-3 w-full space-y-2">
      {actions.map((action) => {
        const state = actionState[action.id];
        const applied = state === "applied";
        const applying = state === "applying";

        return (
          <div key={action.id} className="rounded-lg border border-leaf/15 bg-white p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-ink">{action.label}</p>
                <p className="mt-1 text-sm leading-5 text-ink/70">{action.description}</p>
              </div>
              <span className="shrink-0 rounded-full bg-leaf/10 px-2 py-1 text-[11px] font-bold uppercase text-leaf">
                {action.target.type}
              </span>
            </div>
            <p className="mt-2 text-xs font-semibold text-ink/55">
              Target: {action.target.title}
              {action.target.status ? ` (${action.target.status})` : ""}
            </p>
            <p className="mt-2 text-xs leading-5 text-rust">{action.safety_note}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onApplyAction(action)}
                disabled={applying || applied}
                className="inline-flex min-h-10 items-center gap-2 rounded-md bg-leaf px-3 py-2 text-sm font-bold text-white transition hover:bg-leaf/90 disabled:cursor-default disabled:opacity-65"
              >
                {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {applied ? "Applied" : applying ? "Applying" : "Apply"}
              </button>
              {action.target.href ? (
                <a
                  href={action.target.href}
                  className="inline-flex min-h-10 items-center gap-2 rounded-md border border-ink/15 bg-white px-3 py-2 text-sm font-bold text-ink"
                >
                  <ExternalLink className="h-4 w-4" />
                  Open
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Avatar({ role }: { role: "user" | "assistant" }) {
  const isUser = role === "user";

  return (
    <div
      className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        isUser ? "bg-ink text-white" : "bg-leaf/10 text-leaf"
      }`}
    >
      {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
    </div>
  );
}

function EvidenceSummary({ evidence, missingData }: { evidence: unknown; missingData: unknown }) {
  const record = evidence && typeof evidence === "object" && !Array.isArray(evidence)
    ? evidence as Record<string, unknown>
    : {};
  const notes = stringArray(record.evidence_notes);
  const actions = stringArray(record.suggested_actions);
  const missing = stringArray(missingData);

  if (!notes.length && !actions.length && !missing.length) {
    return <p className="mt-2 text-sm text-ink/65">Evidence is available in the raw details below.</p>;
  }

  return (
    <div className="mt-3 space-y-3 text-sm">
      {notes.length ? (
        <div>
          <p className="font-bold">Evidence notes</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/75">
            {notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </div>
      ) : null}
      {missing.length ? (
        <div>
          <p className="font-bold">Missing data</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/75">
            {missing.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
      ) : null}
      {actions.length ? (
        <div>
          <p className="font-bold">Suggested actions</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink/75">
            {actions.map((action) => <li key={action}>{action}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function stringArray(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}
