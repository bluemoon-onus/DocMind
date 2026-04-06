"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PdfUploader from "./components/PdfUploader";
import RagPipeline from "./components/RagPipeline";
import ChatInterface, { type Message, type Source } from "./components/ChatInterface";
import { chunkText } from "@/lib/chunker";
import { cosineSimilarity, searchSimilar } from "@/lib/vectorSearch";
import { useI18n, type Locale } from "@/lib/i18n";

interface StepDetails {
  characters?: number;
  pages?: number;
  chunks?: number;
  embeddedCount?: number;
  totalChunks?: number;
  dimension?: number;
}

function LocaleToggle() {
  const { locale, setLocale } = useI18n();
  const isEn = locale === "en";
  return (
    <button
      role="switch"
      aria-checked={isEn}
      onClick={() => setLocale(isEn ? "ko" : "en")}
      className="relative flex items-center w-[88px] h-8 rounded-full bg-white/15 hover:bg-white/25 transition-colors cursor-pointer select-none"
    >
      <span
        className={`absolute z-10 w-[42px] h-6 rounded-full bg-white/90 shadow transition-transform duration-200 ${
          isEn ? "translate-x-[43px]" : "translate-x-[3px]"
        }`}
      />
      <span
        className={`relative z-20 flex-1 text-center text-xs font-semibold transition-colors duration-200 ${
          !isEn ? "text-slate-800" : "text-white/70"
        }`}
      >
        한국어
      </span>
      <span
        className={`relative z-20 flex-1 text-center text-xs font-semibold transition-colors duration-200 ${
          isEn ? "text-slate-800" : "text-white/70"
        }`}
      >
        EN
      </span>
    </button>
  );
}

export default function Home() {
  const { t, locale } = useI18n();
  const [pipelineStep, setPipelineStep] = useState(0);
  const [stepDetails, setStepDetails] = useState<StepDetails>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pipelineError, setPipelineError] = useState<string | undefined>();
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
  const [queryStep, setQueryStep] = useState<string | null>(null);
  const [queryStepDetails, setQueryStepDetails] = useState<Record<string, object>>({});

  const chunksRef = useRef<string[]>([]);
  const embeddingsRef = useRef<number[][]>([]);
  const queryingRef = useRef(false);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTextRef = useRef<{ text: string; pageCount: number } | null>(null);

  // 개발 모드: 브라우저 콘솔에서 디버깅 가능
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      (window as any).__docmind = {
        get chunks() { return chunksRef.current; },
        get embeddings() { return embeddingsRef.current; },
        get querying() { return queryingRef.current; },
      };
    }
  }, []);

  function startTimer() {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsedTime(Date.now() - startTimeRef.current);
    }, 100);
  }

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsedTime(Date.now() - startTimeRef.current);
  }

  function resetPipeline() {
    setPipelineStep(0);
    setStepDetails({});
    setElapsedTime(0);
    setPipelineError(undefined);
    setIsReady(false);
    setMessages([]);
    setExampleQuestions([]);
    chunksRef.current = [];
    embeddingsRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const handleTextExtracted = useCallback(async (text: string, pageCount: number) => {
    lastTextRef.current = { text, pageCount };
    resetPipeline();
    startTimer();

    setPipelineStep(1);
    setStepDetails({ characters: text.length, pages: pageCount });
    await new Promise((r) => setTimeout(r, 300));

    setPipelineStep(2);
    const chunks = chunkText(text);
    chunksRef.current = chunks.map((c) => c.text);
    setStepDetails((d) => ({ ...d, chunks: chunks.length }));
    await new Promise((r) => setTimeout(r, 300));

    setPipelineStep(3);
    setStepDetails((d) => ({
      ...d,
      embeddedCount: 0,
      totalChunks: chunks.length,
    }));

    try {
      const response = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: chunksRef.current }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));

          if (json.type === "progress") {
            setStepDetails((d) => ({
              ...d,
              embeddedCount: json.completed,
              totalChunks: json.total,
            }));
          } else if (json.type === "done") {
            embeddingsRef.current = json.embeddings;
            setStepDetails((d) => ({
              ...d,
              embeddedCount: chunks.length,
              totalChunks: chunks.length,
              dimension: json.dimension,
            }));
          } else if (json.type === "error") {
            throw new Error(json.error);
          }
        }
      }

      setPipelineStep(4);
      await new Promise((r) => setTimeout(r, 400));

      setPipelineStep(6);
      stopTimer();
      setIsReady(true);

      fetch("/api/rag/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunks: chunksRef.current, locale }),
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.questions?.length) setExampleQuestions(data.questions);
        })
        .catch(() => {});
    } catch (err) {
      stopTimer();
      setPipelineError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [locale]);

  const handleSendMessage = useCallback(async (question: string) => {
    if (queryingRef.current) return;
    if (!chunksRef.current.length || !embeddingsRef.current.length) {
      alert(t("errDataExpired"));
      resetPipeline();
      return;
    }
    queryingRef.current = true;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: question,
    };

    const assistantId = `a-${Date.now()}`;
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      streaming: true,
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setQueryStep("embedding");
    setQueryStepDetails({});

    let sources: Source[] = [];
    let content = "";

    try {
      setQueryStepDetails((prev) => ({
        ...prev,
        embedding: {
          input: {
            question,
            charCount: question.length,
            model: "amazon.titan-embed-text-v2:0",
            dimension: 1024,
          },
        },
      }));

      const embedRes = await fetch("/api/rag/embed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question }),
      });
      const embedData = await embedRes.json();
      if (embedData.error) throw new Error(embedData.error);
      const queryEmbedding: number[] = embedData.embedding;

      setQueryStepDetails((prev) => ({
        ...prev,
        embedding: {
          ...prev.embedding,
          output: {
            outputDimension: queryEmbedding.length,
            vectorSample: queryEmbedding.slice(0, 8).map((v) => +v.toFixed(6)),
            vectorNorm: +Math.sqrt(queryEmbedding.reduce((s, v) => s + v * v, 0)).toFixed(6),
          },
        },
      }));

      setQueryStep("searching");

      const allScores = embeddingsRef.current
        .map((emb, idx) => ({ index: idx, score: +cosineSimilarity(queryEmbedding, emb).toFixed(4) }))
        .sort((a, b) => b.score - a.score);

      const topMatches = searchSimilar(queryEmbedding, embeddingsRef.current);

      setQueryStepDetails((prev) => ({
        ...prev,
        searching: {
          input: {
            totalChunks: embeddingsRef.current.length,
            algorithm: "Cosine Similarity",
            threshold: "N/A (Top-K)",
            vectorDimension: queryEmbedding.length,
          },
          output: {
            matchesFound: topMatches.length,
            scores: topMatches.map((m) => ({ chunk: m.index, score: +m.score.toFixed(4) })),
            allScores: allScores.map((s) => ({ chunk: s.index, score: s.score })),
            scoreRange: { max: allScores[0]?.score ?? 0, min: allScores[allScores.length - 1]?.score ?? 0 },
          },
        },
      }));

      setQueryStep("retrieving");

      if (topMatches.length === 0) {
        throw new Error(t("errNoContext"));
      }

      sources = topMatches.map((m) => ({
        text: chunksRef.current[m.index],
        score: m.score,
        index: m.index,
      }));
      const contextTexts = sources.map((s) => s.text);
      const totalContextChars = contextTexts.reduce((sum, t) => sum + t.length, 0);

      setQueryStepDetails((prev) => ({
        ...prev,
        retrieving: {
          input: { topK: 3, matchCount: topMatches.length },
          output: {
            chunks: sources.map((s) => ({
              index: s.index,
              chars: s.text.length,
              score: +s.score.toFixed(4),
              preview: s.text.slice(0, 150),
            })),
            totalChars: totalContextChars,
          },
        },
      }));

      setQueryStep("prompting");

      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, contexts: contextTexts, locale }),
      });

      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = JSON.parse(line.slice(6));

          if (json.type === "step") {
            setQueryStep(json.step);
            if (json.detail) {
              setQueryStepDetails((prev) => ({
                ...prev,
                [json.step]: { ...(prev[json.step] ?? {}), input: json.detail },
              }));
            }
          } else if (json.type === "step_done") {
            if (json.detail) {
              setQueryStepDetails((prev) => ({
                ...prev,
                [json.step]: { ...(prev[json.step] ?? {}), output: json.detail },
              }));
            }
          } else if (json.type === "token") {
            content += json.token;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content } : m
              )
            );
          } else if (json.type === "error") {
            throw new Error(json.error);
          }
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, content, sources, streaming: false } : m
        )
      );
      setQueryStep("done");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `${t("errPrefix")}${errMsg}`, streaming: false }
            : m
        )
      );
      setQueryStep("done");
    } finally {
      queryingRef.current = false;
    }
  }, [t, locale]);

  const handleRetry = useCallback(() => {
    if (lastTextRef.current) {
      handleTextExtracted(lastTextRef.current.text, lastTextRef.current.pageCount);
    }
  }, [handleTextExtracted]);

  return (
    <main className="min-h-screen py-10 px-4">
      {/* Header */}
      <div className="max-w-5xl mx-auto mb-8">
        <div className="bg-[#1a365d] rounded-2xl px-8 py-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🧠</span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{t("appTitle")}</h1>
                <p className="text-blue-200 text-sm mt-0.5">{t("appSubtitle")}</p>
              </div>
            </div>
            <LocaleToggle />
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {pipelineStep > 0 ? t("uploadTitleAnother") : t("uploadTitle")}
          </h2>
          <PdfUploader
            onTextExtracted={handleTextExtracted}
            disabled={pipelineStep > 0 && !isReady && !pipelineError}
          />
        </div>

        {pipelineStep > 0 && (
          <div className="animate-fade-in">
            <RagPipeline
              currentStep={pipelineStep}
              stepDetails={stepDetails}
              elapsedTime={elapsedTime}
              error={pipelineError}
              onRetry={pipelineError ? handleRetry : undefined}
            />
          </div>
        )}

        {pipelineStep > 0 && (
          <div className="animate-fade-in">
            <ChatInterface
              isReady={isReady}
              messages={messages}
              exampleQuestions={exampleQuestions}
              queryStep={queryStep}
              queryStepDetails={queryStepDetails}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}
      </div>
    </main>
  );
}
