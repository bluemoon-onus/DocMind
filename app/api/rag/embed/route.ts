import { NextRequest, NextResponse } from "next/server";
import { embedText } from "@/lib/bedrock";

export async function POST(request: NextRequest) {
  try {
    const { text } = (await request.json()) as { text: string };
    if (!text) {
      return NextResponse.json({ error: "text required" }, { status: 400 });
    }
    const embedding = await embedText(text);
    return NextResponse.json({ embedding });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
