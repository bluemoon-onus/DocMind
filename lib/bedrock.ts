import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
  type InvokeModelCommandOutput,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
  },
});

export async function embedText(text: string): Promise<number[]> {
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      inputText: text,
      dimensions: 1024,
      normalize: true,
    }),
  });
  const response = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  return body.embedding as number[];
}

export async function embedTexts(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  let completed = 0;

  for (let i = 0; i < texts.length; i += 5) {
    const batch = texts.slice(i, i + 5);
    const batchResults = await Promise.all(batch.map((text) => embedText(text)));
    for (let j = 0; j < batchResults.length; j++) {
      results[i + j] = batchResults[j];
      completed++;
      onProgress?.(completed, texts.length);
    }
  }

  return results;
}

export async function generateQuestions(chunks: string[]): Promise<string[]> {
  const sample = chunks.slice(0, 5).join("\n\n");
  const command = new InvokeModelCommand({
    modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 256,
      system:
        "You generate example questions a user might ask about a document. Return ONLY a JSON array of exactly 3 short questions in the document's language. No explanation, no markdown — just the JSON array.",
      messages: [
        {
          role: "user",
          content: `Based on this document content, generate 3 example questions:\n\n${sample}`,
        },
      ],
    }),
  });

  const response: InvokeModelCommandOutput = await client.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text = body.content?.[0]?.text ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  return match ? JSON.parse(match[0]) : [];
}

export async function* generateAnswer(
  question: string,
  contexts: string[]
): AsyncGenerator<string> {
  const contextText = contexts
    .map((c, i) => `[Context ${i + 1}]\n${c}`)
    .join("\n\n");

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 1024,
      system:
        "You are a helpful assistant that answers questions based ONLY on the provided document context. If the answer is not found in the context, say you couldn't find it. Answer in the same language as the question. Be concise but thorough.",
      messages: [
        {
          role: "user",
          content: `Context:\n${contextText}\n\nQuestion: ${question}`,
        },
      ],
    }),
  });

  const response = await client.send(command);
  if (!response.body) return;

  for await (const event of response.body) {
    if (event.chunk?.bytes) {
      const chunk = JSON.parse(new TextDecoder().decode(event.chunk.bytes));
      if (chunk.type === "content_block_delta" && chunk.delta?.text) {
        yield chunk.delta.text as string;
      }
    }
  }
}
