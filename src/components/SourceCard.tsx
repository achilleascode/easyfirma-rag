interface SourceCardProps {
  source: {
    title: string;
    url: string | null;
    similarity: number;
  };
}

export function SourceCard({ source }: SourceCardProps) {
  const percent = Math.round(source.similarity * 100);

  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-xs px-3 py-2 bg-white/80 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-white transition-all duration-150 group"
      >
        <span className="flex-1 truncate text-gray-800 group-hover:text-blue-700 transition-colors">
          {source.title}
        </span>
        <span className="text-gray-400 shrink-0 text-[11px]">{percent}%</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs px-3 py-2 bg-white/80 rounded-lg border border-gray-200">
      <span className="flex-1 truncate text-gray-800">{source.title}</span>
      <span className="text-gray-400 shrink-0 text-[11px]">{percent}%</span>
    </div>
  );
}
