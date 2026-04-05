"use client";

type StepStatus = "waiting" | "active" | "completed" | "error";

interface StepDetails {
  characters?: number;
  pages?: number;
  chunks?: number;
  embeddedCount?: number;
  totalChunks?: number;
  dimension?: number;
}

interface RagPipelineProps {
  currentStep: number;
  stepDetails: StepDetails;
  elapsedTime: number;
  error?: string;
  onRetry?: () => void;
}

const STEPS = [
  { icon: "📄", label: "Text Extraction" },
  { icon: "✂️", label: "Chunking" },
  { icon: "🧮", label: "Embedding" },
  { icon: "📊", label: "Indexing" },
  { icon: "✅", label: "Ready" },
];

function stepStatus(stepIndex: number, currentStep: number): StepStatus {
  const step = stepIndex + 1;
  if (step < currentStep) return "completed";
  if (step === currentStep) return "active";
  return "waiting";
}

function stepStat(index: number, details: StepDetails): string {
  switch (index) {
    case 0:
      return details.characters != null
        ? `${details.characters.toLocaleString()} chars from ${details.pages} pages`
        : "";
    case 1:
      return details.chunks != null
        ? `${details.chunks} chunks (~500 tokens each)`
        : "";
    case 2:
      return details.embeddedCount != null
        ? `${details.embeddedCount}/${details.totalChunks} chunks embedded`
        : "";
    case 3:
      return details.dimension != null
        ? `Vector index built (${details.dimension}-dimensional)`
        : "";
    case 4:
      return "Ready! Ask anything about your document.";
    default:
      return "";
  }
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function RagPipeline({
  currentStep,
  stepDetails,
  elapsedTime,
  error,
  onRetry,
}: RagPipelineProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-gray-800">RAG Pipeline</h2>
        {elapsedTime > 0 && (
          <span className="text-sm text-gray-400 font-mono">{formatTime(elapsedTime)}</span>
        )}
      </div>

      {/* Steps */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-0">
        {STEPS.map((step, i) => {
          const status = stepStatus(i, currentStep);
          return (
            <div key={i} className="flex sm:flex-col items-center sm:flex-1 gap-2 sm:gap-0">
              {/* Connector (left of step on mobile, above on desktop) */}
              {i > 0 && (
                <div
                  className={`w-8 h-0.5 sm:w-0.5 sm:h-4 sm:self-center flex-shrink-0 ${
                    status === "completed" || status === "active"
                      ? "bg-orange-400"
                      : "bg-gray-200"
                  }`}
                />
              )}

              {/* Step node */}
              <div className="flex flex-col items-center text-center px-1 sm:px-2 flex-1 sm:flex-none">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold border-2 transition-all ${
                    status === "completed"
                      ? "bg-orange-100 border-orange-400 text-orange-600"
                      : status === "active"
                      ? "bg-blue-800 border-blue-900 text-white"
                      : status === "error"
                      ? "bg-red-100 border-red-400 text-red-600"
                      : "bg-gray-50 border-gray-200 text-gray-400"
                  }`}
                >
                  {status === "active" ? (
                    <span className="animate-spin inline-block w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    step.icon
                  )}
                </div>
                <p
                  className={`text-xs font-medium mt-1.5 ${
                    status === "completed"
                      ? "text-orange-600"
                      : status === "active"
                      ? "text-blue-900"
                      : "text-gray-400"
                  }`}
                >
                  {step.label}
                </p>
                {status !== "waiting" && (
                  <p className="text-xs text-gray-500 mt-0.5 max-w-[100px]">
                    {stepStat(i, stepDetails)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-4">
          <span>{error}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="shrink-0 text-red-700 border border-red-300 rounded px-3 py-1 hover:bg-red-100 transition-colors font-medium"
            >
              재시도
            </button>
          )}
        </div>
      )}
    </div>
  );
}
