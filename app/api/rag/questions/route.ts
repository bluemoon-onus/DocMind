import { NextRequest, NextResponse } from "next/server";
import { generateQuestions } from "@/lib/bedrock";

export async function POST(request: NextRequest) {
  try {
    const { chunks, locale } = (await request.json()) as { chunks: string[]; locale?: string };
    if (!chunks?.length) {
      return NextResponse.json({ error: "chunks required" }, { status: 400 });
    }
    const questions = await generateQuestions(chunks, locale);
    return NextResponse.json({ questions });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
