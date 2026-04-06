"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

interface Source {
  text: string;
  score: number;
  index: number;
}

interface SourceViewerProps {
  sources: Source[];
}

export default function SourceViewer({ sources }: SourceViewerProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  if (sources.length === 0) return null;

  const srcFn = t("srcSources") as (n: number) => string;
  const chunkFn = t("srcChunk") as (n: number) => string;

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen((v) => !v)}
        className="text-sm text-blue-700 hover:text-orange-500 font-medium flex items-center gap-1 transition-colors"
      >
        <span>{open ? "▾" : "▸"}</span>
        <span>{srcFn(sources.length)}</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {sources.map((source, i) => {
            const isExpanded = expanded[i];
            const preview = isExpanded ? source.text : source.text.slice(0, 200);
            const pct = Math.round(source.score * 100);

            return (
              <div
                key={i}
                className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-medium text-gray-600">{chunkFn(source.index + 1)}</span>
                  <span className="text-orange-600 font-mono text-xs">{pct}%</span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-1.5 mb-2">
                  <div
                    className="bg-orange-400 h-1.5 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>

                <p className="text-gray-700 leading-relaxed">
                  {preview}
                  {source.text.length > 200 && (
                    <>
                      {!isExpanded && "..."}
                      <button
                        onClick={() => setExpanded((v) => ({ ...v, [i]: !v[i] }))}
                        className="ml-1 text-blue-600 hover:text-blue-800 font-medium"
                      >
                        {isExpanded ? t("srcLess") : t("srcMore")}
                      </button>
                    </>
                  )}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
