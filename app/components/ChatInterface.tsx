"use client";

import { useEffect, useRef, useState } from "react";
import SourceViewer from "./SourceViewer";

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
}

interface ChatInterfaceProps {
  isReady: boolean;
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
}

const EXAMPLE_QUESTIONS = [
  "X100 센서의 동작 온도 범위는?",
  "G500에서 센서가 안 잡힐 때?",
  "What connectivity options does X100 have?",
  "How many sensors can G500 handle?",
];

export default function ChatInterface({
  isReady,
  messages,
  onSendMessage,
}: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending || !isReady) return;
    setInput("");
    setSending(true);
    try {
      await onSendMessage(text);
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
    <div className={`bg-white rounded-xl border flex flex-col ${isReady ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-800">Chat</h2>
        {!isReady && (
          <p className="text-sm text-gray-400 mt-0.5">
            Complete the pipeline above to start chatting
          </p>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 min-h-[300px] max-h-[500px]">
        {messages.length === 0 && isReady && (
          <div className="text-center text-gray-400 text-sm py-8">
            문서에 대해 무엇이든 물어보세요!
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
              {msg.content}
              {msg.streaming && (
                <span className="inline-block w-1.5 h-4 bg-gray-500 ml-1 animate-pulse rounded" />
              )}
              {msg.role === "assistant" && !msg.streaming && msg.sources && (
                <SourceViewer sources={msg.sources} />
              )}
            </div>
          </div>
        ))}

        {sending && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-gray-100 text-gray-500 rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
              Thinking...
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Example questions */}
      {isReady && messages.length === 0 && (
        <div className="px-6 pb-3 flex flex-wrap gap-2">
          {EXAMPLE_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              disabled={sending}
              className="text-xs px-3 py-1.5 rounded-full border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isReady ? "질문을 입력하세요..." : "파이프라인 완료 후 사용 가능"}
          disabled={!isReady || sending}
          className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-50 disabled:cursor-not-allowed transition-all"
        />
        <button
          onClick={handleSend}
          disabled={!isReady || sending || !input.trim()}
          className="px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          전송
        </button>
      </div>
    </div>
  );
}

export type { Message, Source };
