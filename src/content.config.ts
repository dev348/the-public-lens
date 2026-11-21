import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CATEGORY_SLUGS } from './lib/site';

// The editor may save empty optional fields as "" or null. Treat both as "not set"
// so one blank field can never break the build.
const blank = (v: unknown) => (v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v);
const optStr = () => z.preprocess(blank, z.string().optional());
const strDefault = (d: string) => z.preprocess(blank, z.string().default(d));
const optDate = () => z.preprocess(blank, z.coerce.date().optional());
const boolDefault = (d: boolean) => z.preprocess(blank, z.boolean().default(d));

// Remembers which file owns each id, so two articles with the same web address
// in the same language both stay on the site instead of one silently replacing the other.
const owners = new Map<string, string>();

const articles = defineCollection({
  loader: glob({
    // articles/ = written in the site editor (Pages CMS); gdocs/ = synced from Google Docs.
    pattern: '{articles,gdocs}/**/*.md',
    base: './src/content',
    // The id is "<lang>/<slug>", so an English and a Marathi article can share
    // the same web address without overwriting each other.
    generateId: ({ entry, data }) => {
      const lang = data.lang === 'mr' ? 'mr' : 'en';
      const slug = typeof data.slug === 'string' && data.slug.trim()
        ? data.slug.trim()
        : entry.replace(/\.md$/, '').split('/').pop()!;
      for (const [id, owner] of owners) if (owner === entry) owners.delete(id);
      let id = `${lang}/${slug}`;
      for (let n = 2; owners.has(id); n++) id = `${lang}/${slug}-${n}`;
      if (id !== `${lang}/${slug}`) {
        console.warn(`[articles] "${entry}" uses the same web address as another ${lang} article; publishing it at "${id}".`);
      }
      owners.set(id, entry);
      return id;
    },
  }),
  schema: z.object({
    title: z.string(),
    slug: optStr(),
    description: strDefault(''),
    date: z.coerce.date(),
    updated: optDate(),
    author: strDefault('Mithila Manohar Raut'),
    category: z.enum(CATEGORY_SLUGS),
    lang: z.preprocess(blank, z.enum(['en', 'mr']).default('en')),
    image: optStr(),
    imageAlt: strDefault(''),
    imageCredit: optStr(),
    sources: z.preprocess(
      (v) => blank(v) ?? [],
      z.array(z.object({ title: z.string(), url: optStr() })),
    ),
    featured: boolDefault(false),
    draft: boolDefault(false),
    // Set on articles synced from Google Docs.
    gdocId: optStr(),
    gdocModified: optStr(),
  }),
});

export const collections = { articles };
