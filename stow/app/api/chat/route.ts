import { NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";
import { Message } from "@/types/chat";

export async function POST(req: Request) {
  if (req.signal.aborted) {
    return new Response(null, { status: 499 });
  }

  try {
    const body = await req.json();
    const { messages } = body as { messages?: Message[] };

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json(
        { error: "Invalid request: messages array is required and cannot be empty." },
        { status: 400 }
      );
    }

    const assistantContent = await callLLM(messages, req.signal);

    if (req.signal.aborted) {
      return new Response(null, { status: 499 });
    }

    return NextResponse.json({
      role: "assistant",
      content: assistantContent,
    });
  } catch (error: unknown) {
    if (
      req.signal.aborted ||
      (error instanceof Error && error.name === "AbortError")
    ) {
      // Client intentionally aborted the request
      return new Response(null, { status: 499 });
    }

    const errorMessage =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("[/api/chat] Error generating LLM response:", errorMessage);

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
