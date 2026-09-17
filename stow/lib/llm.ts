import { Message } from "@/types/chat";

const SYSTEM_PROMPT =
  "You are MyStorage Assistant, a friendly and helpful storage customer assistant. " +
  "You assist customers in estimating their storage needs and discussing their items. " +
  "Keep your responses concise, helpful, and polite.";

export interface LLMOptions {
  systemPrompt?: string;
  jsonMode?: boolean;
}

export async function callLLM(
  messages: Message[],
  signal?: AbortSignal,
  options?: LLMOptions
): Promise<string> {
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const modelGeminiName = process.env.MODEL_GEMINI_NAME?.trim() || "gemini-3.5-flash-lite";

  if (geminiApiKey) {
    return callGemini(messages, geminiApiKey, modelGeminiName, signal, options);
  }

  if (openaiApiKey) {
    return callOpenAI(messages, openaiApiKey, signal, options);
  }

  throw new Error(
    "LLM API key not configured. Please set GEMINI_API_KEY or OPENAI_API_KEY in .env.local"
  );
}

async function callGemini(
  messages: Message[],
  apiKey: string,
  modelName: string,
  signal?: AbortSignal,
  options?: LLMOptions
): Promise<string> {
  // Format contents according to Gemini API specification
  // Filter out empty messages if any
  const contents = messages
    .filter((m) => m.content.trim().length > 0)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const systemPrompt = options?.systemPrompt || SYSTEM_PROMPT;
  const requestBody: Record<string, unknown> = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents,
  };

  if (options?.jsonMode) {
    requestBody.generationConfig = {
      responseMimeType: "application/json",
    };
  }

  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `Gemini API error (status ${response.status}): ${errorBody || response.statusText}`
    );
  }

  const data = await response.json();
  const candidateText =
    data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!candidateText) {
    throw new Error("No response content received from Gemini.");
  }

  return candidateText.trim();
}

async function callOpenAI(
  messages: Message[],
  apiKey: string,
  signal?: AbortSignal,
  options?: LLMOptions
): Promise<string> {
  const systemPrompt = options?.systemPrompt || SYSTEM_PROMPT;
  const formattedMessages = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content,
      })),
  ];

  const requestBody: Record<string, unknown> = {
    model: "gpt-4o-mini",
    messages: formattedMessages,
  };

  if (options?.jsonMode) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `OpenAI API error (status ${response.status}): ${errorBody || response.statusText}`
    );
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("No response content received from OpenAI.");
  }

  return content.trim();
}
