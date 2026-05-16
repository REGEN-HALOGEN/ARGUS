import type React from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

export const Markdown: React.FC<MarkdownProps> = ({ content, className = '' }) => {
  // Simple regex-based markdown parser for basic formatting
  // This avoids adding heavy dependencies while fixing the visual issue

  const lines = content.split('\n');

  return (
    <div className={`markdown-content space-y-2 ${className}`}>
      {lines.map((line, i) => {
        // Headers
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">
              {line.replace('### ', '')}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl font-bold text-foreground mt-6 mb-3">
              {line.replace('## ', '')}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="text-2xl font-bold text-foreground mt-8 mb-4">
              {line.replace('# ', '')}
            </h1>
          );
        }

        // Horizontal Rule
        if (line.trim() === '---') {
          return <hr key={i} className="border-card-border my-6" />;
        }

        // Lists
        if (line.trim().startsWith('* ') || line.trim().startsWith('- ')) {
          const text = line.trim().replace(/^[*|-]\s+/, '');
          return (
            <div key={i} className="flex gap-3 pl-2">
              <span className="text-primary-400 mt-1.5">•</span>
              <p className="flex-1 text-muted-foreground/80">{renderInline(text)}</p>
            </div>
          );
        }

        // Empty lines
        if (line.trim() === '') {
          return <div key={i} className="h-2" />;
        }

        // Regular paragraphs
        return (
          <p key={i} className="text-muted-foreground/80 leading-relaxed">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
};

function renderInline(text: string) {
  // Bold formatting: **text**
  const parts = text.split(/(\*\*.*?\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-bold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    // Inline code: `text`
    const codeParts = part.split(/(`.*?`)/g);
    return codeParts.map((codePart, j) => {
      if (codePart.startsWith('`') && codePart.endsWith('`')) {
        return (
          <code
            key={`${i}-${j}`}
            className="bg-card/60 px-1.5 py-0.5 rounded text-primary-300 text-xs font-mono"
          >
            {codePart.slice(1, -1)}
          </code>
        );
      }
      return codePart;
    });
  });
}
