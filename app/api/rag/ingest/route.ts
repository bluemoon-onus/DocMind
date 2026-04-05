import { NextRequest } from "next/server";
import { embedTexts } from "@/lib/bedrock";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  function sseEvent(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: "AWS credentials not configured. Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in .env.local" })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  let chunks: string[];
  try {
    const body = (await request.json()) as { chunks: string[] };
    chunks = body.chunks;
    if (!Array.isArray(chunks) || chunks.length === 0) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", error: "chunks array is required" })}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }
  } catch {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: "Invalid request body" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const embeddings = await embedTexts(chunks, (completed, total) => {
          controller.enqueue(sseEvent({ type: "progress", completed, total }));
        });

        controller.enqueue(
          sseEvent({ type: "done", embeddings, dimension: 1024 })
        );
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
}
