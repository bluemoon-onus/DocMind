import { NextRequest } from "next/server";
import { embedText, generateAnswer } from "@/lib/bedrock";
import { searchSimilar } from "@/lib/vectorSearch";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  function sseEvent(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const { question, chunks, embeddings } = (await request.json()) as {
      question: string;
      chunks: string[];
      embeddings: number[][];
    };

    if (!question || !chunks || !embeddings) {
      return new Response(
        JSON.stringify({ type: "error", error: "question, chunks, and embeddings are required" }),
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Embed the question
          const queryEmbedding = await embedText(question);

          // Find top-3 similar chunks
          const topMatches = searchSimilar(queryEmbedding, embeddings);
          const sources = topMatches.map((m) => ({
            text: chunks[m.index],
            score: m.score,
            index: m.index,
          }));

          // Send sources first
          controller.enqueue(sseEvent({ type: "sources", sources }));

          // Stream the answer
          const contextTexts = sources.map((s) => s.text);
          for await (const token of generateAnswer(question, contextTexts)) {
            controller.enqueue(sseEvent({ type: "token", token }));
          }

          controller.enqueue(sseEvent({ type: "done" }));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          controller.enqueue(sseEvent({ type: "error", error: message }));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(`data: ${JSON.stringify({ type: "error", error: message })}\n\n`, {
      status: 500,
      headers: { "Content-Type": "text/event-stream" },
    });
  }
}
