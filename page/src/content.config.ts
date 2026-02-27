import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['zh', 'en']),
    order: z.number().optional(),
  }),
});

const showcase = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/showcase' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['zh', 'en']),
    icon: z.string(),
    tags: z.array(z.string()),
    color: z.string().optional(),
  }),
});

const dev = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/dev' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lang: z.enum(['zh', 'en']),
    order: z.number(),
    sidebar_label: z.string(),
  }),
});

export const collections = { pages, showcase, dev };
