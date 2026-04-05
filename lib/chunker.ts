export interface Chunk {
  id: string;
  text: string;
  index: number;
  charStart: number;
  charEnd: number;
  preview: string;
}

function estimateTokens(text: string): number {
  // Korean characters: ~0.5 tokens each, English words: ~1.3 tokens each
  const koreanChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) ?? []).length;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.ceil(koreanChars * 0.5 + (words - koreanChars * 0.1) * 1.3);
}

function splitToFitTokens(text: string, maxTokens: number): string[] {
  if (estimateTokens(text) <= maxTokens) return [text];

  // Try splitting by newline
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 1) {
    const groups: string[] = [];
    let current = "";
    for (const line of lines) {
      const candidate = current ? `${current}\n${line}` : line;
      if (estimateTokens(candidate) > maxTokens && current) {
        groups.push(current);
        current = line;
      } else {
        current = candidate;
      }
    }
    if (current) groups.push(current);
    return groups;
  }

  // Try splitting by sentence
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const groups: string[] = [];
  let current = "";
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (estimateTokens(candidate) > maxTokens && current) {
      groups.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
  }
  if (current) groups.push(current);
  return groups.length > 0 ? groups : [text];
}

export function chunkText(text: string): Chunk[] {
  const MAX_TOKENS = 500;
  const OVERLAP_TOKENS = 50;

  // Split by double newline (paragraph)
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());

  // Further split paragraphs that exceed max tokens
  const rawChunks: string[] = [];
  for (const para of paragraphs) {
    const parts = splitToFitTokens(para.trim(), MAX_TOKENS);
    rawChunks.push(...parts);
  }

  if (rawChunks.length === 0) return [];

  // Build final chunks with overlap
  const chunks: Chunk[] = [];
  let charPos = 0;

  for (let i = 0; i < rawChunks.length; i++) {
    let chunkText = rawChunks[i];

    // Add overlap from previous chunk
    if (i > 0) {
      const prevWords = rawChunks[i - 1].split(/\s+/);
      const overlapWords: string[] = [];
      let overlapTokens = 0;
      for (let j = prevWords.length - 1; j >= 0 && overlapTokens < OVERLAP_TOKENS; j--) {
        overlapWords.unshift(prevWords[j]);
        overlapTokens += 1.3;
      }
      if (overlapWords.length > 0) {
        chunkText = overlapWords.join(" ") + " " + chunkText;
      }
    }

    const charStart = text.indexOf(rawChunks[i], charPos);
    const charEnd = charStart + rawChunks[i].length;
    charPos = charStart + 1;

    chunks.push({
      id: `chunk-${i}`,
      text: chunkText,
      index: i,
      charStart: Math.max(0, charStart),
      charEnd: Math.max(0, charEnd),
      preview: chunkText.slice(0, 100),
    });
  }

  return chunks;
}
