import { SourceCard } from "./SourceCard";

interface Source {
  title: string;
  url: string | null;
  similarity: number;
}

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
  };
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-blue-600 text-white"
            : "bg-gray-100 text-gray-800"
        }`}
      >
        <div
          className="prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline [&_img]:rounded-lg [&_img]:my-2"
          dangerouslySetInnerHTML={{
            __html: formatMarkdown(message.content),
          }}
        />

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-1.5">
            <p className="text-xs font-medium text-gray-500">Quellen:</p>
            {message.sources.map((source, i) => (
              <SourceCard key={i} source={source} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-gray-200 px-1 rounded text-sm">$1</code>')
    .replace(/!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, "<br />");
}
