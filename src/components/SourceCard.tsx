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
        className="flex items-center gap-2 text-xs px-2 py-1.5 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
      >
        <span className="text-blue-600">📄</span>
        <span className="flex-1 truncate text-gray-700">{source.title}</span>
        <span className="text-gray-400 shrink-0">{percent}%</span>
      </a>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs px-2 py-1.5 bg-white rounded-lg border border-gray-200">
      <span className="text-blue-600">📄</span>
      <span className="flex-1 truncate text-gray-700">{source.title}</span>
      <span className="text-gray-400 shrink-0">{percent}%</span>
    </div>
  );
}
