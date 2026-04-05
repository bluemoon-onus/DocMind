"use client";

import { useRef, useState } from "react";

interface PdfUploaderProps {
  onTextExtracted: (text: string, pageCount: number) => void;
  disabled?: boolean;
}

export default function PdfUploader({ onTextExtracted, disabled }: PdfUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "uploading" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function processPdf(file: File) {
    if (file.type !== "application/pdf") {
      setError("PDF 파일만 업로드 가능합니다.");
      return;
    }
    setError(null);
    setStatus("uploading");

    try {
      const arrayBuffer = await file.arrayBuffer();
      setStatus("processing");

      // Load PDF.js from CDN directly — bypasses Turbopack bundling issues with browser-only APIs
      // Using Function constructor to make the URL opaque to TypeScript and bundlers
      const cdnImport = new Function("url", "return import(url)");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfjsLib: any = await cdnImport(
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.min.mjs"
      );
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs";

      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      if (pdf.numPages > 5) {
        setError("This demo supports PDFs with 5 pages or fewer.");
        setStatus("idle");
        return;
      }

      let fullText = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((item: any) => ("str" in item ? item.str : ""))
          .join(" ");
        fullText += pageText + "\n\n";
      }

      if (!fullText.trim()) {
        setError("No text could be extracted. This PDF may contain only images.");
        setStatus("idle");
        return;
      }

      setStatus("idle");
      onTextExtracted(fullText, pdf.numPages);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`PDF 처리 중 오류가 발생했습니다: ${msg}`);
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
      setError("샘플 PDF를 불러오는 데 실패했습니다.");
      setStatus("idle");
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) processPdf(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processPdf(file);
    e.target.value = "";
  }

  const isLoading = status !== "idle";

  return (
    <div className="space-y-4">
      {/* Drop zone */}
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
          accept="application/pdf"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isLoading}
        />
        <div className="text-4xl mb-3">📄</div>
        {isLoading ? (
          <p className="text-blue-700 font-medium">
            {status === "uploading" ? "파일 로드 중..." : "PDF 텍스트 추출 중..."}
          </p>
        ) : (
          <>
            <p className="text-gray-700 font-medium">PDF를 드래그하거나 클릭하여 업로드</p>
            <p className="text-gray-400 text-sm mt-1">최대 5페이지</p>
          </>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* Sample PDFs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => loadSamplePdf("NovaTech_X100_Installation_Guide.pdf")}
          disabled={disabled || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-800 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📄 Try: X100 Sensor Manual
        </button>
        <button
          onClick={() => loadSamplePdf("NovaTech_G500_Gateway_Manual.pdf")}
          disabled={disabled || isLoading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 hover:border-blue-400 text-blue-800 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          📄 Try: G500 Gateway Manual
        </button>
      </div>
    </div>
  );
}
