'use client';

import { useState } from 'react';
import type { Message } from '@/types';
import { Button } from '@/components/ui/button';

interface CodeBlockProps {
  message: Message;
}

/**
 * Renders code content with language label and copy button.
 * Currently uses CSS for basic styling. Syntax highlighting (shiki) can be added later.
 */
export function CodeBlock({ message }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const language = message.schema?.language?.value as string ?? extractLanguage(message.format);
  const code = message.body;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
    }
  };

  return (
    <div className="rounded-md border overflow-hidden max-w-lg">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted text-xs">
        {language && <span className="font-mono text-muted-foreground">{language}</span>}
        {!language && <span />}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 text-xs px-2"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <pre className="p-3 overflow-x-auto text-sm bg-muted/30">
        <code className={language ? `language-${language}` : ''}>{code}</code>
      </pre>
    </div>
  );
}

function extractLanguage(format?: string): string {
  if (!format) return '';
  // format like "text/x-code;lang=rust" or "text/x-rust"
  const langMatch = format.match(/lang=(\w+)/);
  if (langMatch) return langMatch[1];
  const typeMatch = format.match(/text\/x-(\w+)/);
  if (typeMatch) return typeMatch[1];
  return '';
}
