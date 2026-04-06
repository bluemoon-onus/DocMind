import { NextRequest } from "next/server";
import { generateAnswer } from "@/lib/bedrock";

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  function sseEvent(data: object): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  try {
    const { question, contexts } = (await request.json()) as {
      question: string;
      contexts: string[];
    };

    if (!question || !contexts?.length) {
      return new Response(
        JSON.stringify({ type: "error", error: "question and contexts are required" }),
        { status: 400, headers: { "Content-Type": "text/event-stream" } }
      );
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Step: Build prompt with context
          const systemPrompt = "You are a helpful assistant that answers questions based ONLY on the provided document context. If the answer is not found in the context, say you couldn't find it. Answer in the same language as the question. Be concise but thorough.";
          const userPrompt = `Context:\n${contexts.map((c, i) => `[Context ${i + 1}]\n${c}`).join("\n\n")}\n\nQuestion: ${question}`;
          controller.enqueue(sseEvent({
            type: "step", step: "prompting",
            detail: {
              systemPromptChars: systemPrompt.length,
              userPromptChars: userPrompt.length,
              totalPromptChars: systemPrompt.length + userPrompt.length,
              contextSlots: contexts.length,
              systemPromptPreview: systemPrompt,
              userPromptPreview: userPrompt.slice(0, 300),
            },
          }));
          controller.enqueue(sseEvent({
            type: "step_done", step: "prompting",
            detail: { ready: true },
          }));

          // Step: LLM streaming
          controller.enqueue(sseEvent({
            type: "step", step: "generating",
            detail: {
              model: "us.anthropic.claude-haiku-4-5-20251001-v1:0",
              maxTokens: 1024,
              streaming: true,
              anthropicVersion: "bedrock-2023-05-31",
              temperature: "default",
            },
          }));
          let tokenCount = 0;
          let totalChars = 0;
          for await (const token of generateAnswer(question, contexts)) {
            tokenCount++;
            totalChars += token.length;
            controller.enqueue(sseEvent({ type: "token", token }));
          }
          controller.enqueue(sseEvent({
            type: "step_done", step: "generating",
            detail: { outputTokenChunks: tokenCount, outputChars: totalChars },
          }));

          controller.enqueue(sseEvent({ type: "step", step: "done" }));
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
