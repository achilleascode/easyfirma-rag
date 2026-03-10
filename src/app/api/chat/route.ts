import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { retrieveContext } from "@/lib/rag";
import { buildSystemPrompt } from "@/lib/prompt";
import { createServiceClient } from "@/lib/supabase";

const MODEL = "claude-haiku-4-5-20251001";

function getAnthropic() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const { messages, sessionId } = await req.json();

  const lastUserMessage = messages[messages.length - 1]?.content;
  if (!lastUserMessage) {
    return new Response("No message provided", { status: 400 });
  }

  // Retrieve relevant context via RAG
  const ragStart = Date.now();
  const { contextText, sources } = await retrieveContext(lastUserMessage);
  const ragMs = Date.now() - ragStart;

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
  const llmStart = Date.now();
  let firstTokenMs = 0;

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";
      let tokenCount = 0;

      try {
        const response = getAnthropic().messages.stream({
          model: MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: conversationHistory,
        });

        for await (const event of response) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            if (tokenCount === 0) {
              firstTokenMs = Date.now() - llmStart;
            }
            tokenCount++;
            const text = event.delta.text;
            fullResponse += text;

            // Send metadata with first chunk only
            const meta = tokenCount === 1 ? {
              model: MODEL,
              ragMs,
              firstTokenMs,
              topSimilarity: sources.length > 0 ? sources[0].similarity : 0,
              chunksFound: sources.length,
            } : undefined;

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ text, sources, meta })}\n\n`)
            );
          }
        }

        const totalMs = Date.now() - startTime;

        // Send done signal with final stats
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({
          done: true,
          stats: {
            model: MODEL,
            ragMs,
            firstTokenMs,
            totalMs,
            tokenCount,
            topSimilarity: sources.length > 0 ? Math.round(sources[0].similarity * 100) : 0,
            chunksFound: sources.length,
          }
        })}\n\n`));
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
      "X-Model": MODEL,
    },
  });
}
