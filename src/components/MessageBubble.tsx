import { marked } from "marked";
import { SourceCard } from "./SourceCard";

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface Source {
  title: string;
  url: string | null;
  similarity: number;
}

interface MessageMeta {
  model: string;
  ragMs: number;
  firstTokenMs: number;
  totalMs?: number;
  tokenCount?: number;
  topSimilarity: number;
  chunksFound: number;
}

interface MessageBubbleProps {
  message: {
    role: "user" | "assistant";
    content: string;
    sources?: Source[];
    meta?: MessageMeta;
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
            : "bg-gray-100 text-black"
        }`}
      >
        {isUser ? (
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
        ) : (
          <div
            className="prose prose-sm max-w-none text-black leading-relaxed
              [&_h1]:text-base [&_h1]:font-bold [&_h1]:text-black [&_h1]:mt-3 [&_h1]:mb-1
              [&_h2]:text-sm [&_h2]:font-bold [&_h2]:text-black [&_h2]:mt-3 [&_h2]:mb-1
              [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-black [&_h3]:mt-2 [&_h3]:mb-1
              [&_strong]:text-black [&_strong]:font-semibold
              [&_em]:text-gray-800
              [&_a]:text-blue-700 [&_a]:underline [&_a]:underline-offset-2
              [&_code]:bg-gray-200 [&_code]:text-black [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs
              [&_pre]:bg-gray-200 [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:my-2 [&_pre]:overflow-x-auto
              [&_img]:rounded-lg [&_img]:my-2 [&_img]:max-w-full [&_img]:block [&_img]:h-auto
              [&_ul]:list-disc [&_ul]:pl-4 [&_ul]:my-1
              [&_ol]:list-decimal [&_ol]:pl-4 [&_ol]:my-1
              [&_li]:text-black [&_li]:my-0.5
              [&_p]:text-black [&_p]:my-1
              [&_blockquote]:border-l-2 [&_blockquote]:border-gray-300 [&_blockquote]:pl-3 [&_blockquote]:text-gray-700"
            dangerouslySetInnerHTML={{
              __html: marked.parse(message.content) as string,
            }}
          />
        )}

        {message.sources && message.sources.length > 0 && (
          <div className="mt-3 pt-3 border-t border-gray-200/60 space-y-1.5">
            <p className="text-xs font-medium text-gray-600">Quellen:</p>
            {message.sources.map((source, i) => (
              <SourceCard key={i} source={source} />
            ))}
          </div>
        )}

        {message.meta && (
          <div className="mt-2 pt-2 border-t border-gray-200/40 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-black">
            <span>{message.meta.model}</span>
            {message.meta.totalMs ? (
              <span>{(message.meta.totalMs / 1000).toFixed(1)}s gesamt</span>
            ) : message.meta.firstTokenMs ? (
              <span>{message.meta.firstTokenMs}ms TTFT</span>
            ) : null}
            {message.meta.ragMs > 0 && <span>{message.meta.ragMs}ms RAG</span>}
            {message.meta.chunksFound > 0 && <span>{message.meta.chunksFound} Chunks</span>}
            {message.meta.topSimilarity > 0 && (
              <span>{typeof message.meta.topSimilarity === "number" && message.meta.topSimilarity < 1
                ? `${Math.round(message.meta.topSimilarity * 100)}%`
                : `${message.meta.topSimilarity}%`} Relevanz</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

