import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORY_SLUGS } from './lib/site';

const articles = defineCollection({
  loader: glob({
    pattern: '**/*.md',
    base: './src/content/articles',
    // The id is "<lang>/<slug>", so an English and a Marathi article can share
    // the same web address without overwriting each other.
    generateId: ({ entry, data }) => {
      const lang = data.lang === 'mr' ? 'mr' : 'en';
      const slug = typeof data.slug === 'string' && data.slug
        ? data.slug
        : entry.replace(/\.md$/, '').split('/').pop()!;
      return `${lang}/${slug}`;
    },
  }),
  schema: z.object({
    title: z.string(),
    slug: z.string().optional(),
    description: z.string().default(''),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    author: z.string().default('Mithila Manohar Raut'),
    category: z.enum(CATEGORY_SLUGS),
    lang: z.enum(['en', 'mr']).default('en'),
    image: z.string().optional(),
    imageAlt: z.string().default(''),
    imageCredit: z.string().optional(),
    sources: z
      .array(z.object({ title: z.string(), url: z.string().optional() }))
      .default([]),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
