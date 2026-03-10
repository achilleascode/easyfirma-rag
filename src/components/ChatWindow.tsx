"use client";

import { useState, useRef, useEffect } from "react";
import { ChatInput } from "./ChatInput";
import { MessageBubble } from "./MessageBubble";

interface Source {
  title: string;
  url: string | null;
  similarity: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
}

const quickStartQuestions = [
  "Wie erstelle ich eine Rechnung mit Skonto?",
  "EasyFirma auf neuen PC umziehen",
  "Kleinunternehmerregelung einstellen",
  "E-Mail Versand funktioniert nicht",
];

export function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(input: string) {
    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    const allMessages = [...messages, userMessage].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, sessionId }),
      });

      if (!res.ok) throw new Error("API error");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";
      let sources: Source[] = [];

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "", sources: [] },
      ]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) {
                assistantContent += parsed.error;
              } else {
                assistantContent += parsed.text || "";
                if (parsed.sources?.length) sources = parsed.sources;
              }

              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantContent,
                  sources,
                };
                return updated;
              });
            } catch {
              // skip malformed JSON
            }
          }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Es ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie office@easyfirma.net.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-3xl mx-auto">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center mt-20 animate-fade-in">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              EasyFirma Support
            </h2>
            <p className="text-sm text-gray-500">
              Stellen Sie Ihre Frage zu EasyFirma — ich helfe Ihnen gerne!
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2">
              {quickStartQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => handleSend(q)}
                  className="text-xs px-4 py-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 rounded-full text-gray-800 transition-all duration-200"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className="animate-fade-in"
            style={{ animationDelay: `${i * 50}ms` }}
          >
            <MessageBubble message={msg} />
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-1.5 px-4 py-3">
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" />
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.15s]" />
            <span className="w-2 h-2 bg-gray-300 rounded-full animate-bounce [animation-delay:0.3s]" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput onSend={handleSend} isLoading={isLoading} />
    </div>
  );
}
