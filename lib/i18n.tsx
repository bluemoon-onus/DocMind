"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type Locale = "ko" | "en";

const translations = {
  // ── Header ──
  appTitle: { ko: "DocMind", en: "DocMind" },
  appSubtitle: { ko: "AI 문서 어시스턴트 · Powered by AWS Bedrock RAG", en: "AI Document Assistant · Powered by AWS Bedrock RAG" },

  // ── PdfUploader ──
  uploadTitle: { ko: "PDF 업로드", en: "Upload PDF" },
  uploadTitleAnother: { ko: "다른 파일 업로드", en: "Upload Another File" },
  dropzoneText: { ko: "PDF 또는 TXT를 드래그하거나 클릭하여 업로드", en: "Drag & drop or click to upload PDF or TXT" },
  dropzoneLimit: { ko: "PDF: 2MB·10페이지 이하 / TXT: 500KB 이하", en: "PDF: 2MB · 10 pages max / TXT: 500KB max" },
  loadingFile: { ko: "파일 로드 중...", en: "Loading file..." },
  extractingText: { ko: "텍스트 추출 중...", en: "Extracting text..." },
  sampleX100: { ko: "📄 체험: X100 센서 매뉴얼", en: "📄 Try: X100 Sensor Manual" },
  sampleBedrock: { ko: "📄 체험: AWS Bedrock 소개", en: "📄 Try: About AWS Bedrock" },
  errOnlyPdfTxt: { ko: "PDF 또는 TXT 파일만 업로드 가능합니다.", en: "Only PDF or TXT files are supported." },
  errPdfSize: { ko: (size: string) => `PDF 파일 크기가 2MB를 초과합니다. (${size})`, en: (size: string) => `PDF file exceeds 2MB limit. (${size})` },
  errTxtSize: { ko: (size: string) => `TXT 파일 크기가 500KB를 초과합니다. (${size})`, en: (size: string) => `TXT file exceeds 500KB limit. (${size})` },
  errNoText: { ko: "파일에 텍스트가 없습니다.", en: "No text found in the file." },
  errTxtProcess: { ko: (msg: string) => `TXT 처리 중 오류: ${msg}`, en: (msg: string) => `Error processing TXT: ${msg}` },
  errPdfPages: { ko: (max: number, actual: number) => `이 데모는 ${max}페이지 이하의 PDF만 지원합니다. (${actual}페이지)`, en: (max: number, actual: number) => `This demo supports PDFs with ${max} pages or fewer. (${actual} pages)` },
  errPdfNoText: { ko: "텍스트를 추출할 수 없습니다. 이미지로만 된 PDF일 수 있습니다.", en: "No text could be extracted. This PDF may contain only images." },
  errPdfProcess: { ko: (msg: string) => `PDF 처리 중 오류: ${msg}`, en: (msg: string) => `Error processing PDF: ${msg}` },
  errSampleLoad: { ko: "샘플 PDF를 불러오는 데 실패했습니다.", en: "Failed to load sample PDF." },

  // ── RagPipeline ──
  pipelineTitle: { ko: "RAG 파이프라인", en: "RAG Pipeline" },
  stepExtraction: { ko: "텍스트 추출", en: "Text Extraction" },
  stepChunking: { ko: "청킹", en: "Chunking" },
  stepEmbedding: { ko: "임베딩", en: "Embedding" },
  stepIndexing: { ko: "인덱싱", en: "Indexing" },
  stepReady: { ko: "준비 완료", en: "Ready" },
  statExtraction: { ko: (chars: number, pages: number) => `${chars.toLocaleString()}자, ${pages}페이지`, en: (chars: number, pages: number) => `${chars.toLocaleString()} chars from ${pages} pages` },
  statChunking: { ko: (chunks: number) => `${chunks}개 청크 (~500 토큰)`, en: (chunks: number) => `${chunks} chunks (~500 tokens each)` },
  statEmbedding: { ko: (done: number, total: number) => `${done}/${total} 청크 임베딩 완료`, en: (done: number, total: number) => `${done}/${total} chunks embedded` },
  statIndexing: { ko: (dim: number) => `벡터 인덱스 구축 (${dim}차원)`, en: (dim: number) => `Vector index built (${dim}-dimensional)` },
  statReady: { ko: "준비 완료! 문서에 대해 질문하세요.", en: "Ready! Ask anything about your document." },
  retry: { ko: "재시도", en: "Retry" },

  // ── ChatInterface ──
  chatTitle: { ko: "채팅", en: "Chat" },
  chatDisabled: { ko: "파이프라인 완료 후 채팅이 가능합니다", en: "Complete the pipeline above to start chatting" },
  chatPlaceholder: { ko: "질문을 입력하세요...", en: "Type your question..." },
  chatPlaceholderDisabled: { ko: "파이프라인 완료 후 사용 가능", en: "Available after pipeline completes" },
  chatSend: { ko: "전송", en: "Send" },
  chatEmpty: { ko: "문서에 대해 무엇이든 물어보세요!", en: "Ask anything about your document!" },
  chatThinking: { ko: "생각 중...", en: "Thinking..." },

  // ── Processing panel ──
  procCompleted: { ko: "완료", en: "Completed" },
  procProcessing: { ko: "처리 중", en: "Processing" },
  stepQueryEmbed: { ko: "질문 벡터 변환", en: "Query Embedding" },
  stepVectorSearch: { ko: "벡터 유사도 검색", en: "Vector Similarity Search" },
  stepTopK: { ko: "Top-K 컨텍스트 추출", en: "Top-K Context Retrieval" },
  stepPrompt: { ko: "프롬프트 구성", en: "Prompt Construction" },
  stepGenerate: { ko: "LLM 답변 생성", en: "LLM Answer Generation" },

  // ── Processing detail labels ──
  lblModel: { ko: "모델", en: "Model" },
  lblDimension: { ko: "차원", en: "Dimension" },
  lblOutputVector: { ko: "출력 벡터", en: "Output Vector" },
  lblSearchTarget: { ko: "검색 대상", en: "Search Target" },
  lblChunks: { ko: "개 청크", en: " chunks" },
  lblAlgorithm: { ko: "알고리즘", en: "Algorithm" },
  lblMatches: { ko: "매칭 결과", en: "Matches" },
  lblTopK: { ko: "Top-K", en: "Top-K" },
  lblTotalContext: { ko: "총 컨텍스트", en: "Total Context" },
  lblContextSlots: { ko: "컨텍스트 슬롯", en: "Context Slots" },
  lblTotalPrompt: { ko: "총 프롬프트", en: "Total Prompt" },
  lblMaxTokens: { ko: "최대 토큰", en: "Max Tokens" },
  lblOutputChunks: { ko: "출력 청크", en: "Output Chunks" },
  lblQuestion: { ko: "질문", en: "Question" },
  lblCharCount: { ko: "글자 수", en: "Char Count" },
  lblReqDimension: { ko: "요청 차원", en: "Req. Dimension" },
  lblNormalize: { ko: "정규화", en: "Normalize" },
  lblInput: { ko: "입력 (Input)", en: "Input" },
  lblOutput: { ko: "출력 (Output)", en: "Output" },
  lblVectorDim: { ko: "벡터 차원", en: "Vector Dim." },
  lblVectorNorm: { ko: "벡터 노름", en: "Vector Norm" },
  lblVectorSample: { ko: "벡터 샘플 (처음 8개):", en: "Vector Sample (first 8):" },
  lblParameters: { ko: "파라미터", en: "Parameters" },
  lblTotalChunks: { ko: "전체 청크 수", en: "Total Chunks" },
  lblThreshold: { ko: "임계값", en: "Threshold" },
  lblMatchResult: { ko: "매칭 결과 (Top Matches)", en: "Top Matches" },
  lblMatchCount: { ko: "매칭 수", en: "Match Count" },
  lblScoreDist: { ko: "전체 스코어 분포", en: "Score Distribution" },
  lblMax: { ko: "최고", en: "Max" },
  lblMin: { ko: "최저", en: "Min" },
  lblGreenAbove: { ko: "녹색 = 임계값 이상", en: "Green = above threshold" },
  lblCandidates: { ko: "후보 수", en: "Candidates" },
  lblStructure: { ko: "구조 (Structure)", en: "Structure" },
  lblSystemPrompt: { ko: "시스템 프롬프트", en: "System Prompt" },
  lblUserPrompt: { ko: "사용자 프롬프트", en: "User Prompt" },
  lblUserPromptPreview: { ko: "사용자 프롬프트 (미리보기)", en: "User Prompt (Preview)" },
  lblModelConfig: { ko: "모델 설정 (Configuration)", en: "Model Configuration" },
  lblApiVersion: { ko: "API 버전", en: "API Version" },
  lblStreaming: { ko: "스트리밍", en: "Streaming" },
  lblStreamChunks: { ko: "스트림 청크", en: "Stream Chunks" },
  lblOutputChars: { ko: "출력 글자 수", en: "Output Chars" },

  // ── SourceViewer ──
  srcSources: { ko: (n: number) => `📎 출처 (${n}개 청크)`, en: (n: number) => `📎 Sources (${n} chunks found)` },
  srcChunk: { ko: (n: number) => `청크 ${n}`, en: (n: number) => `Chunk ${n}` },
  srcMore: { ko: " 더보기", en: " Show more" },
  srcLess: { ko: " 접기", en: " Show less" },

  // ── Response time ──
  responseComplete: { ko: "응답완료", en: "Response Complete" },
  responseUnit: { ko: "초", en: "s" },

  // ── Misc ──
  errDataExpired: { ko: "문서 데이터가 만료되었습니다. PDF를 다시 업로드해 주세요.", en: "Document data expired. Please re-upload your file." },
  errNoContext: { ko: "관련 컨텍스트를 찾지 못했습니다. 질문을 다르게 해 보세요.", en: "No relevant context found. Try rephrasing your question." },
  errPrefix: { ko: "오류: ", en: "Error: " },
  unitChars: { ko: "자", en: " chars" },
  unitItems: { ko: "개", en: "" },
} as const;

type TranslationKey = keyof typeof translations;

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: <K extends TranslationKey>(key: K) => (typeof translations)[K]["ko"];
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("ko");

  const t = useCallback(
    <K extends TranslationKey>(key: K) => {
      return translations[key][locale] as (typeof translations)[K]["ko"];
    },
    [locale]
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
