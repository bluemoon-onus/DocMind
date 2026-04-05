"use client";

import { useCallback, useRef, useState } from "react";
import PdfUploader from "./components/PdfUploader";
import RagPipeline from "./components/RagPipeline";
import ChatInterface, { type Message, type Source } from "./components/ChatInterface";
import { chunkText } from "@/lib/chunker";

interface StepDetails {
  characters?: number;
  pages?: number;
  chunks?: number;
  embeddedCount?: number;
  totalChunks?: number;
  dimension?: number;
}

export default function Home() {
  const [pipelineStep, setPipelineStep] = useState(0);
  const [stepDetails, setStepDetails] = useState<StepDetails>({});
  const [elapsedTime, setElapsedTime] = useState(0);
  const [pipelineError, setPipelineError] = useState<string | undefined>();
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);

  const chunksRef = useRef<string[]>([]);
  const embeddingsRef = useRef<number[][]>([]);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTextRef = useRef<{ text: string; pageCount: number } | null>(null);

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
    chunksRef.current = [];
    embeddingsRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
  }

  const handleTextExtracted = useCallback(async (text: string, pageCount: number) => {
    lastTextRef.current = { text, pageCount };
    resetPipeline();
    startTimer();

    // Step 1: Text Extraction complete
    setPipelineStep(1);
    setStepDetails({ characters: text.length, pages: pageCount });
    await new Promise((r) => setTimeout(r, 300));

    // Step 2: Chunking
    setPipelineStep(2);
    const chunks = chunkText(text);
    chunksRef.current = chunks.map((c) => c.text);
    setStepDetails((d) => ({ ...d, chunks: chunks.length }));
    await new Promise((r) => setTimeout(r, 300));

    // Step 3: Embedding
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

      // Step 4: Indexing
      setPipelineStep(4);
      await new Promise((r) => setTimeout(r, 400));

      // Step 5: Ready
      setPipelineStep(5);
      stopTimer();
      setIsReady(true);
    } catch (err) {
      stopTimer();
      setPipelineError(err instanceof Error ? err.message : "Unknown error");
    }
  }, []);

  const handleSendMessage = useCallback(async (question: string) => {
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

    let sources: Source[] = [];
    let content = "";

    try {
      const response = await fetch("/api/rag/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          chunks: chunksRef.current,
          embeddings: embeddingsRef.current,
        }),
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

          if (json.type === "sources") {
            sources = json.sources;
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
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `오류: ${errMsg}`, streaming: false }
            : m
        )
      );
    }
  }, []);

  const handleRetry = useCallback(() => {
    if (lastTextRef.current) {
      handleTextExtracted(lastTextRef.current.text, lastTextRef.current.pageCount);
    }
  }, [handleTextExtracted]);

  return (
    <main className="min-h-screen py-10 px-4">
      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="bg-[#1a365d] rounded-2xl px-8 py-6 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🧠</span>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">DocMind</h1>
              <p className="text-blue-200 text-sm mt-0.5">
                AI Document Assistant · Powered by AWS Bedrock RAG
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto space-y-6">
        {/* Uploader */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {pipelineStep > 0 ? "다른 PDF 업로드" : "PDF 업로드"}
          </h2>
          <PdfUploader
            onTextExtracted={handleTextExtracted}
            disabled={pipelineStep > 0 && !isReady && !pipelineError}
          />
        </div>

        {/* Pipeline */}
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

        {/* Chat */}
        {pipelineStep > 0 && (
          <div className="animate-fade-in">
            <ChatInterface
              isReady={isReady}
              messages={messages}
              onSendMessage={handleSendMessage}
            />
          </div>
        )}
      </div>
    </main>
  );
}
