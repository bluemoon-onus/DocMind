import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelWithResponseStreamCommand,
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

export async function* generateAnswer(
  question: string,
  contexts: string[]
): AsyncGenerator<string> {
  const contextText = contexts
    .map((c, i) => `[Context ${i + 1}]\n${c}`)
    .join("\n\n");

  const command = new InvokeModelWithResponseStreamCommand({
    modelId: "anthropic.claude-3-5-haiku-20241022-v1:0",
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
