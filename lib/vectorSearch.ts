export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export function searchSimilar(
  queryEmbedding: number[],
  chunkEmbeddings: number[][],
  topK = 3
): { index: number; score: number }[] {
  const scores = chunkEmbeddings.map((emb, index) => ({
    index,
    score: cosineSimilarity(queryEmbedding, emb),
  }));

  return scores
    .filter((s) => s.score >= 0.3)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
