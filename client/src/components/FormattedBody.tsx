import React from "react";

export function FormattedInlineText({ text }: { text: string }) {
  if (!text) return null;
  // Split tokens for bold (**text** or __text__), italic (*text* or _text_), and links ([text](url))
  const tokens = text.split(/(\*\*[^*]+\*\*|__[^_]+__|(?<!\*)\*[^*]+\*(?!\*)|\b_[^_]+_\b|\[[^\]]+\]\([^)]+\))/g);

  return (
    <>
      {tokens.map((token, index) => {
        if (!token) return null;

        // Bold: **text** or __text__
        if (
          (token.startsWith("**") && token.endsWith("**") && token.length > 4) ||
          (token.startsWith("__") && token.endsWith("__") && token.length > 4)
        ) {
          return <strong key={index}>{token.slice(2, -2)}</strong>;
        }

        // Italic: *text* or _text_
        if (
          (token.startsWith("*") && token.endsWith("*") && token.length > 2) ||
          (token.startsWith("_") && token.endsWith("_") && token.length > 2)
        ) {
          return <em key={index}>{token.slice(1, -1)}</em>;
        }

        // Markdown link: [label](url)
        const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (linkMatch) {
          return (
            <a
              key={index}
              href={linkMatch[2]}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link"
            >
              {linkMatch[1]}
            </a>
          );
        }

        return token;
      })}
    </>
  );
}

export function FormattedBody({ body, className }: { body: string; className?: string }) {
  if (!body) return null;
  const paragraphs = body.split(/\r?\n\r?\n|\n/);

  return (
    <div className={className}>
      {paragraphs.map((p, i) => (
        <p key={i}>
          <FormattedInlineText text={p} />
        </p>
      ))}
    </div>
  );
}
