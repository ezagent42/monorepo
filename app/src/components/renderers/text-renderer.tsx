'use client';

import type { Message } from '@/types';

interface TextRendererProps {
  message: Message;
}

/**
 * Renders text/plain and text/markdown content.
 * For markdown, uses a simple built-in parser.
 * For plain text, renders as a simple preformatted paragraph.
 */
export function TextRenderer({ message }: TextRendererProps) {
  const isMarkdown = message.format === 'text/markdown';

  if (isMarkdown) {
    return <MarkdownContent body={message.body} />;
  }

  return <p className="text-sm whitespace-pre-wrap break-words">{message.body}</p>;
}

/**
 * Markdown renderer using a simple built-in parser.
 * Wraps the output with prose styling for consistent typography.
 */
function MarkdownContent({ body }: { body: string }) {
  return (
    <div className="text-sm prose prose-sm dark:prose-invert max-w-none break-words">
      <MarkdownRenderer content={body} />
    </div>
  );
}

/**
 * Simple markdown renderer that handles common patterns.
 * Uses dangerouslySetInnerHTML with a minimal parser to keep
 * dependencies minimal. Can be upgraded to react-markdown + remark-gfm later.
 */
function MarkdownRenderer({ content }: { content: string }) {
  const html = simpleMarkdownToHtml(content);
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Minimal markdown to HTML converter for common patterns.
 * Handles: headers (#-######), bold (**), italic (*), inline code (`),
 * code blocks (```), and line breaks.
 */
export function simpleMarkdownToHtml(md: string): string {
  let html = md;

  // Code blocks (must come before inline processing)
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');

  // Headers (# to ######)
  html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Line breaks (preserve newlines outside of pre blocks)
  html = html.replace(/\n/g, '<br/>');

  return html;
}
