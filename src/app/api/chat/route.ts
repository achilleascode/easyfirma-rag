import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { retrieveContext } from "@/lib/rag";
import { buildSystemPrompt } from "@/lib/prompt";
import { createServiceClient } from "@/lib/supabase";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: NextRequest) {
  const { messages, sessionId } = await req.json();

  const lastUserMessage = messages[messages.length - 1]?.content;
  if (!lastUserMessage) {
    return new Response("No message provided", { status: 400 });
  }

  // Retrieve relevant context via RAG
  const { contextText, sources } = await retrieveContext(lastUserMessage);

  const systemPrompt = buildSystemPrompt(
    contextText || "Kein relevanter Kontext gefunden."
  );

  // Build conversation history (last 6 messages for context)
  const conversationHistory = messages.slice(-6).map((m: { role: string; content: string }) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  // Stream response from Claude
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        const response = getAnthropic().messages.stream({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: conversationHistory,
        });

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            const text = event.delta.text;
            fullResponse += text;
            // Send as SSE
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text, sources })}\n\n`)
            );
          }
        }

        // Send done signal
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();

        // Save to database (fire and forget)
        if (sessionId) {
          const supabase = createServiceClient();
          await supabase.from("chat_messages").insert([
            {
              session_id: sessionId,
              role: "user",
              content: lastUserMessage,
            },
            {
              session_id: sessionId,
              role: "assistant",
              content: fullResponse,
              sources: sources,
            },
          ]);
        }
      } catch (error) {
        console.error("Streaming error:", error);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "Ein Fehler ist aufgetreten." })}\n\n`
          )
        );
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
