import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { Message } from "@/types/chat";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body as { messages?: Message[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: messages array is required and cannot be empty." },
        { status: 400 }
      );
    }

    const assistantContent = await callLLM(messages);

    return NextResponse.json({
      role: "assistant",
      content: assistantContent,
    });
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("[/api/chat] Error generating LLM response:", errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
