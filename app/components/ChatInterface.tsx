"use client";

import { useEffect, useRef, useState } from "react";
import SourceViewer from "./SourceViewer";
import { useI18n } from "@/lib/i18n";

interface Source {
  text: string;
  score: number;
  index: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  streaming?: boolean;
  responseTime?: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

interface ChatInterfaceProps {
  isReady: boolean;
  messages: Message[];
  exampleQuestions: string[];
  queryStep: string | null;
  queryStepDetails: Record<string, any>;
  onSendMessage: (message: string) => Promise<void>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 text-[20px]">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-600 text-right font-mono truncate">{value}</span>
    </div>
  );
}

function StepSummary({ stepKey, detail, t }: { stepKey: string; detail: any; t: any }) {
  const inp = detail?.input ?? {};
  const out = detail?.output ?? {};

  switch (stepKey) {
    case "embedding":
      return (
        <div className="space-y-0.5">
          {inp.model && <DetailRow label={t("lblModel")} value={String(inp.model).replace("amazon.", "")} />}
          {inp.dimension && <DetailRow label={t("lblDimension")} value={`${inp.dimension}d`} />}
          {out.outputDimension && <DetailRow label={t("lblOutputVector")} value={`${out.outputDimension}d float[]`} />}
        </div>
      );
    case "searching":
      return (
        <div className="space-y-0.5">
          {inp.totalChunks && <DetailRow label={t("lblSearchTarget")} value={`${inp.totalChunks}${t("lblChunks")}`} />}
          {inp.algorithm && <DetailRow label={t("lblAlgorithm")} value={String(inp.algorithm)} />}
          {out.matchesFound != null && <DetailRow label={t("lblMatches")} value={`${out.matchesFound}${t("unitItems")}`} />}
        </div>
      );
    case "retrieving":
      return (
        <div className="space-y-0.5">
          {inp.topK && <DetailRow label={t("lblTopK")} value={`${inp.topK}`} />}
          {out.totalChars && <DetailRow label={t("lblTotalContext")} value={`${Number(out.totalChars).toLocaleString()}${t("unitChars")}`} />}
        </div>
      );
    case "prompting":
      return (
        <div className="space-y-0.5">
          {inp.contextSlots && <DetailRow label={t("lblContextSlots")} value={`${inp.contextSlots}${t("unitItems")}`} />}
          {inp.totalPromptChars && <DetailRow label={t("lblTotalPrompt")} value={`${Number(inp.totalPromptChars).toLocaleString()}${t("unitChars")}`} />}
        </div>
      );
    case "generating":
      return (
        <div className="space-y-0.5">
          {inp.model && <DetailRow label={t("lblModel")} value={String(inp.model).replace("us.anthropic.", "").replace("-v1:0", "")} />}
          {inp.maxTokens && <DetailRow label={t("lblMaxTokens")} value={`${inp.maxTokens}`} />}
          {out.outputTokenChunks && <DetailRow label={t("lblOutputChunks")} value={`${out.outputTokenChunks}${t("unitItems")}`} />}
        </div>
      );
    default:
      return null;
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[20px] font-semibold text-gray-500 uppercase tracking-wide mb-1">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[20px]">
      <span className="text-gray-400 shrink-0">{label}</span>
      <span className="text-gray-600 text-right font-mono break-all">{value}</span>
    </div>
  );
}

function ExpandedDetail({ stepKey, detail, t }: { stepKey: string; detail: any; t: any }) {
  const inp = detail?.input ?? {};
  const out = detail?.output ?? {};

  switch (stepKey) {
    case "embedding":
      return (
        <div className="space-y-3">
          <Section title={t("lblInput")}>
            <KV label={t("lblQuestion")} value={`"${String(inp.question ?? "").slice(0, 20)}…"`} />
            <KV label={t("lblCharCount")} value={`${inp.charCount ?? "-"}`} />
            <KV label={t("lblModel")} value={String(inp.model ?? "")} />
            <KV label={t("lblReqDimension")} value={`${inp.dimension ?? "-"}`} />
            <KV label={t("lblNormalize")} value="true" />
          </Section>
          <Section title={t("lblOutput")}>
            <KV label={t("lblVectorDim")} value={`${out.outputDimension ?? "-"}d`} />
            <KV label={t("lblVectorNorm")} value={`${out.vectorNorm ?? "-"}`} />
            {out.vectorSample && (
              <div>
                <p className="text-[20px] text-gray-400 mb-1">{t("lblVectorSample")}</p>
                <pre className="text-[18px] text-gray-500 font-mono bg-gray-100 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all">
                  [{(out.vectorSample as number[]).map((v: number) => v.toFixed(6)).join(", ")}]
                </pre>
              </div>
            )}
          </Section>
        </div>
      );

    case "searching":
      return (
        <div className="space-y-3">
          <Section title={t("lblParameters")}>
            <KV label={t("lblTotalChunks")} value={`${inp.totalChunks ?? "-"}${t("unitItems")}`} />
            <KV label={t("lblAlgorithm")} value={String(inp.algorithm ?? "")} />
            <KV label={t("lblThreshold")} value={String(inp.threshold ?? "-")} />
            <KV label={t("lblVectorDim")} value={`${inp.vectorDimension ?? "-"}d`} />
          </Section>
          <Section title={t("lblMatchResult")}>
            <KV label={t("lblMatchCount")} value={`${out.matchesFound ?? "-"}${t("unitItems")}`} />
            {out.scores && (out.scores as any[]).map((s: any) => (
              <div key={s.chunk} className="flex items-center gap-2">
                <KV label={`#${s.chunk}`} value={s.score.toFixed(4)} />
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-400 rounded-full" style={{ width: `${Math.max(s.score * 100, 2)}%` }} />
                </div>
              </div>
            ))}
          </Section>
          {out.allScores && (
            <Section title={t("lblScoreDist")}>
              <KV label={t("lblMax")} value={`${out.scoreRange?.max ?? "-"}`} />
              <KV label={t("lblMin")} value={`${out.scoreRange?.min ?? "-"}`} />
              <div className="flex gap-[2px] items-end h-10 mt-1">
                {(out.allScores as any[]).map((s: any, i: number) => (
                  <div
                    key={i}
                    className="flex-1 rounded-t-sm"
                    style={{
                      height: `${Math.max(s.score * 100, 2)}%`,
                      backgroundColor: s.score >= 0.05 ? "#4ade80" : "#e5e7eb",
                    }}
                    title={`#${s.chunk}: ${s.score}`}
                  />
                ))}
              </div>
              <p className="text-[18px] text-gray-400 mt-0.5">{t("lblGreenAbove")}</p>
            </Section>
          )}
        </div>
      );

    case "retrieving":
      return (
        <div className="space-y-3">
          <Section title={t("lblParameters")}>
            <KV label={t("lblTopK")} value={`${inp.topK ?? "-"}`} />
            <KV label={t("lblCandidates")} value={`${inp.matchCount ?? "-"}${t("unitItems")}`} />
            <KV label={t("lblTotalContext")} value={`${Number(out.totalChars ?? 0).toLocaleString()}${t("unitChars")}`} />
          </Section>
          {out.chunks && (out.chunks as any[]).map((c: any) => (
            <Section key={c.index} title={`#${c.index} — ${c.chars.toLocaleString()}${t("unitChars")} (${c.score})`}>
              <pre className="text-[18px] text-gray-500 font-mono bg-gray-100 rounded p-1.5 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed max-h-24 overflow-y-auto">
                {c.preview ?? ""}…
              </pre>
            </Section>
          ))}
        </div>
      );

    case "prompting":
      return (
        <div className="space-y-3">
          <Section title={t("lblStructure")}>
            <KV label={t("lblSystemPrompt")} value={`${inp.systemPromptChars ?? "-"}${t("unitChars")}`} />
            <KV label={t("lblUserPrompt")} value={`${Number(inp.userPromptChars ?? 0).toLocaleString()}${t("unitChars")}`} />
            <KV label={t("lblContextSlots")} value={`${inp.contextSlots ?? "-"}${t("unitItems")}`} />
            <KV label={t("lblTotalPrompt")} value={`${Number(inp.totalPromptChars ?? 0).toLocaleString()}${t("unitChars")}`} />
          </Section>
          {inp.systemPromptPreview && (
            <Section title={t("lblSystemPrompt")}>
              <pre className="text-[18px] text-gray-500 font-mono bg-gray-100 rounded p-1.5 whitespace-pre-wrap break-all leading-relaxed max-h-20 overflow-y-auto">
                {inp.systemPromptPreview}
              </pre>
            </Section>
          )}
          {inp.userPromptPreview && (
            <Section title={t("lblUserPromptPreview")}>
              <pre className="text-[18px] text-gray-500 font-mono bg-gray-100 rounded p-1.5 whitespace-pre-wrap break-all leading-relaxed max-h-28 overflow-y-auto">
                {inp.userPromptPreview}…
              </pre>
            </Section>
          )}
        </div>
      );

    case "generating":
      return (
        <div className="space-y-3">
          <Section title={t("lblModelConfig")}>
            <KV label={t("lblModel")} value={String(inp.model ?? "").replace("us.anthropic.", "")} />
            <KV label={t("lblApiVersion")} value={String(inp.anthropicVersion ?? "")} />
            <KV label={t("lblMaxTokens")} value={`${inp.maxTokens ?? "-"}`} />
            <KV label="Temperature" value={String(inp.temperature ?? "default")} />
            <KV label={t("lblStreaming")} value={inp.streaming ? "Yes" : "No"} />
          </Section>
          <Section title={t("lblOutput")}>
            <KV label={t("lblStreamChunks")} value={`${out.outputTokenChunks ?? "-"}${t("unitItems")}`} />
            <KV label={t("lblOutputChars")} value={`${Number(out.outputChars ?? 0).toLocaleString()}${t("unitChars")}`} />
          </Section>
        </div>
      );

    default:
      return null;
  }
}

function QueryProcessing({ currentStep, details, t }: { currentStep: string; details: Record<string, any>; t: any }) {
  const allDone = currentStep === "done";
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const QUERY_STEPS = [
    { key: "embedding", icon: "🧮", label: t("stepQueryEmbed") },
    { key: "searching", icon: "🔍", label: t("stepVectorSearch") },
    { key: "retrieving", icon: "📎", label: t("stepTopK") },
    { key: "prompting", icon: "📝", label: t("stepPrompt") },
    { key: "generating", icon: "💬", label: t("stepGenerate") },
  ];

  function toggleStep(key: string) {
    setExpandedStep((prev) => (prev === key ? null : key));
  }

  return (
    <div className="flex gap-3">
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-2 w-52 shrink-0">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {allDone ? t("procCompleted") : t("procProcessing")}
        </h3>
        {QUERY_STEPS.map((step) => {
          const stepIdx = QUERY_STEPS.findIndex((s) => s.key === step.key);
          const currentIdx = QUERY_STEPS.findIndex((s) => s.key === currentStep);
          const isDone = allDone || stepIdx < currentIdx;
          const isActive = step.key === currentStep && !allDone;
          const hasDetail = details[step.key];
          const isExpanded = expandedStep === step.key;
          const isClickable = hasDetail && (isDone || isActive);

          return (
            <div key={step.key}>
              <div
                className={`flex items-start gap-2 ${isClickable ? "cursor-pointer hover:bg-gray-100 -mx-1 px-1 rounded" : ""} ${isExpanded ? "bg-blue-50 -mx-1 px-1 rounded" : ""}`}
                onClick={() => isClickable && toggleStep(step.key)}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[20px] flex-shrink-0 border mt-0.5 ${
                    isDone
                      ? "bg-green-100 border-green-300 text-green-600"
                      : isActive
                      ? "bg-blue-800 border-blue-900 text-white"
                      : "bg-gray-100 border-gray-200 text-gray-400"
                  }`}
                >
                  {isDone ? "✓" : isActive ? (
                    <span className="animate-spin inline-block w-2.5 h-2.5 border-[1.5px] border-white border-t-transparent rounded-full" />
                  ) : (
                    step.icon
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs font-medium ${
                        isDone ? "text-green-700" : isActive ? "text-blue-800" : "text-gray-400"
                      }`}
                    >
                      {step.label}
                    </span>
                    {isClickable && (
                      <span className={`text-[18px] ${isExpanded ? "text-blue-500" : "text-gray-300"}`}>
                        {isExpanded ? "▼" : "▶"}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {hasDetail && (isDone || isActive) && (
                <div className="ml-8 mt-1 mb-2 pl-2 border-l-2 border-gray-200 space-y-0.5">
                  <StepSummary stepKey={step.key} detail={details[step.key]} t={t} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {expandedStep && details[expandedStep] && (
        <div className="bg-white rounded-xl border border-blue-200 p-4 w-64 shrink-0 overflow-y-auto max-h-[600px] shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
              {QUERY_STEPS.find((s) => s.key === expandedStep)?.label}
            </h3>
            <button
              onClick={() => setExpandedStep(null)}
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕
            </button>
          </div>
          <ExpandedDetail stepKey={expandedStep} detail={details[expandedStep]} t={t} />
        </div>
      )}
    </div>
  );
}

export default function ChatInterface({
  isReady,
  messages,
  exampleQuestions,
  queryStep,
  queryStepDetails,
  onSendMessage,
}: ChatInterfaceProps) {
  const { t } = useI18n();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(text?: string) {
    const q = (text ?? input).trim();
    if (!q || sending || !isReady) return;
    setInput("");
    setSending(true);
    try {
      await onSendMessage(q);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className="flex gap-4">
      <div className={`flex-1 bg-white rounded-xl border flex flex-col min-w-0 ${isReady ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-800">{t("chatTitle")}</h2>
          {!isReady && (
            <p className="text-sm text-gray-400 mt-0.5">{t("chatDisabled")}</p>
          )}
        </div>

        {isReady && messages.length === 0 && exampleQuestions.length > 0 && (
          <div className="px-6 pt-4 pb-2 flex flex-wrap gap-2">
            {exampleQuestions.map((q) => (
              <button
                key={q}
                onClick={() => handleSend(q)}
                disabled={sending}
                className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        <div className="px-6 py-4 border-b border-gray-100 flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isReady ? t("chatPlaceholder") as string : t("chatPlaceholderDisabled") as string}
            disabled={!isReady || sending}
            className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
          />
          <button
            onClick={() => handleSend()}
            disabled={!isReady || sending || !input.trim()}
            className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("chatSend")}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px] max-h-[500px]">
          {messages.length === 0 && isReady && (
            <div className="text-center text-gray-400 text-sm py-8">
              {t("chatEmpty")}
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-blue-800 text-white rounded-br-sm"
                    : "bg-gray-100 text-gray-800 rounded-bl-sm"
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
                {msg.streaming && (
                  <span className="inline-block w-1.5 h-4 bg-gray-500 ml-1 animate-pulse rounded" />
                )}
                {msg.role === "assistant" && !msg.streaming && msg.sources && (
                  <SourceViewer sources={msg.sources} />
                )}
                {msg.role === "assistant" && !msg.streaming && msg.responseTime != null && (
                  <div className="text-xs text-gray-400 mt-2 text-right font-mono">
                    [{t("responseComplete")} : {msg.responseTime.toFixed(1)}{t("responseUnit")}]
                  </div>
                )}
              </div>
            </div>
          ))}

          {sending && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                {t("chatThinking")}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {queryStep && (
        <div className="fixed right-4 top-24 hidden sm:block z-50">
          <QueryProcessing currentStep={queryStep} details={queryStepDetails} t={t} />
        </div>
      )}
    </div>
  );
}

export type { Message, Source };
