"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n";

const MAX_PDF_SIZE = 2 * 1024 * 1024;
const MAX_TXT_SIZE = 500 * 1024;
const MAX_PAGES = 10;
const ACCEPTED_TYPES = ["application/pdf", "text/plain"];
const ACCEPT_STRING = ".pdf,.txt,text/plain,application/pdf";

interface PdfUploaderProps {
  onTextExtracted: (text: string, pageCount: number) => void;
  disabled?: boolean;
}

export default function PdfUploader({ onTextExtracted, disabled }: PdfUploaderProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function validateFile(file: File): string | null {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return t("errOnlyPdfTxt");
    }
    if (file.type === "application/pdf" && file.size > MAX_PDF_SIZE) {
      const fn = t("errPdfSize") as (size: string) => string;
      return fn(`${(file.size / 1024 / 1024).toFixed(1)}MB`);
    }
    if (file.type === "text/plain" && file.size > MAX_TXT_SIZE) {
      const fn = t("errTxtSize") as (size: string) => string;
      return fn(`${(file.size / 1024).toFixed(0)}KB`);
    }
    return null;
  }

  async function processFile(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    if (file.type === "text/plain") {
      await processText(file);
    } else {
      await processPdf(file);
    }
  }

  async function processText(file: File) {
    setStatus("processing");
    try {
      const text = await file.text();
      if (!text.trim()) {
        setError(t("errNoText"));
        setStatus("idle");
        return;
      }
      setStatus("idle");
      onTextExtracted(text, 1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fn = t("errTxtProcess") as (m: string) => string;
      setError(fn(msg));
      setStatus("idle");
    }
  }

  async function processPdf(file: File) {
    setStatus("uploading");
    try {
      const arrayBuffer = await file.arrayBuffer();
      setStatus("processing");

      if (
        typeof ReadableStream !== "undefined" &&
        !(Symbol.asyncIterator in ReadableStream.prototype)
      ) {
        Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, {
          writable: true,
          configurable: true,
          value: async function* () {
            const reader = (this as ReadableStream).getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                yield value;
              }
            } finally {
              reader.releaseLock();
            }
          },
        });
      }

      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      if (pdf.numPages > MAX_PAGES) {
        const fn = t("errPdfPages") as (max: number, actual: number) => string;
        setError(fn(MAX_PAGES, pdf.numPages));
        setStatus("idle");
        return;
      }

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item) => ("str" in item ? (item as { str: string }).str : ""))
          .join(" ");
        fullText += pageText + "\n\n";
      }

      if (!fullText.trim()) {
        setError(t("errPdfNoText"));
        setStatus("idle");
        return;
      }

      setStatus("idle");
      onTextExtracted(fullText, pdf.numPages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fn = t("errPdfProcess") as (m: string) => string;
      setError(fn(msg));
      setStatus("idle");
    }
  }

  async function loadSamplePdf(filename: string) {
    setError(null);
    setStatus("uploading");
    try {
      const response = await fetch(`/samples/${filename}`);
      const blob = await response.blob();
      const file = new File([blob], filename, { type: "application/pdf" });
      await processPdf(file);
    } catch {
      setError(t("errSampleLoad"));
      setStatus("idle");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = "";
  }

  const isLoading = status !== "idle";

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && !isLoading && inputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${isDragging ? "border-orange-400 bg-orange-50" : "border-blue-300 hover:border-orange-400 hover:bg-blue-50"}
          ${disabled || isLoading ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_STRING}
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isLoading}
        />
        <div className="text-4xl mb-3">📄</div>
        {isLoading ? (
          <p className="text-blue-700 font-medium">
            {status === "uploading" ? t("loadingFile") : t("extractingText")}
          </p>
        ) : (
          <>
            <p className="text-gray-700 font-medium">{t("dropzoneText")}</p>
            <p className="text-gray-400 text-sm mt-1">{t("dropzoneLimit")}</p>
          </>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => loadSamplePdf("NovaTech_X100_Installation_Guide.pdf")}
          disabled={disabled || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-800 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("sampleX100")}
        </button>
        <button
          onClick={() => loadSamplePdf("NovaTech_G500_Gateway_Manual.pdf")}
          disabled={disabled || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-800 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("sampleG500")}
        </button>
      </div>
    </div>
  );
}
