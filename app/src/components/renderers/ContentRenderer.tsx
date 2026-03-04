'use client';

import type { ResolvedRenderer } from '@/lib/pipeline/types';
import { TextRenderer } from './text-renderer';
import { StructuredCard } from './structured-card';
import { MediaMessage } from './media-message';
import { CodeBlock } from './code-block';
import { DocumentLink } from './document-link';
import { Composite } from './composite';
import { SchemaRenderer } from './schema-renderer';

interface ContentRendererProps {
  resolved: ResolvedRenderer;
}

/**
 * Dispatch component for the render pipeline.
 * Routes to the correct renderer based on the resolved level and type.
 */
export function ContentRenderer({ resolved }: ContentRendererProps) {
  // Level 2: Custom widget component
  if (resolved.level === 2 && resolved.component) {
    const CustomComponent = resolved.component;
    return <CustomComponent message={resolved.message} config={resolved.config} />;
  }

  // Level 1 & Level 0: Route by type
  switch (resolved.type) {
    case 'text':
      return <TextRenderer message={resolved.message} />;
    case 'structured_card':
      return (
        <StructuredCard
          message={resolved.message}
          fieldMapping={resolved.config?.field_mapping ?? {}}
        />
      );
    case 'media_message':
      return <MediaMessage message={resolved.message} />;
    case 'code_block':
      return <CodeBlock message={resolved.message} />;
    case 'document_link':
      return <DocumentLink message={resolved.message} />;
    case 'composite':
      return (
        <Composite
          message={resolved.message}
          subRenderers={resolved.config?.sub_renderers ?? []}
          renderContent={(sub) => <ContentRenderer resolved={sub} />}
        />
      );
    case 'schema':
      return <SchemaRenderer message={resolved.message} />;
    default:
      // Unknown renderer type -- fallback to plain text
      return <TextRenderer message={resolved.message} />;
  }
}
