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
    <div className={`markdown-content space-y-2 overflow-x-auto ${className}`}>
      {lines.map((line, i) => {
        if (line.startsWith('#### ')) {
          return (
            <h4 key={i} className="text-base font-bold text-foreground mt-4 mb-2">
              {renderInline(line.replace('#### ', ''))}
            </h4>
          );
        }
        if (line.startsWith('### ')) {
          return (
            <h3 key={i} className="text-lg font-bold text-foreground mt-4 mb-2">
              {renderInline(line.replace('### ', ''))}
            </h3>
          );
        }
        if (line.startsWith('## ')) {
          return (
            <h2 key={i} className="text-xl font-bold text-foreground mt-6 mb-3">
              {renderInline(line.replace('## ', ''))}
            </h2>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h1 key={i} className="text-2xl font-bold text-foreground mt-8 mb-4">
              {renderInline(line.replace('# ', ''))}
            </h1>
          );
        }

        // Tables
        if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
          const isSeparator = line.includes('|---') || line.includes('|:---');
          if (isSeparator) return null;
          
          const cells = line.split('|').map(s => s.trim()).filter((_, index, arr) => index !== 0 && index !== arr.length - 1);
          
          return (
            <div key={i} className="flex flex-wrap md:flex-nowrap border-b border-card-border/40 py-1.5">
              {cells.map((cell, idx) => (
                <div key={idx} className="flex-1 px-2 py-1 text-sm text-muted-foreground/90 min-w-[120px]">
                  {renderInline(cell)}
                </div>
              ))}
            </div>
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
