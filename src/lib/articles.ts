import { getCollection, type CollectionEntry } from 'astro:content';

export type Article = CollectionEntry<'articles'>;

let warned = false;

export async function getArticles(opts: { lang?: 'en' | 'mr'; category?: string } = {}) {
  const all = await getCollection('articles', ({ data }) => !data.draft);
  if (!warned) {
    warned = true;
    for (const a of all) {
      if (!a.data.image && (a.data.featured || a.data.category === 'ground-stories')) {
        console.warn(`[articles] "${a.data.title}" has no main photo. Ground Stories and featured articles should have one.`);
      }
    }
  }
  return all
    .filter((a) => (opts.lang ? a.data.lang === opts.lang : true))
    .filter((a) => (opts.category ? a.data.category === opts.category : true))
    .sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** Web address part of an article (ids look like "en/<slug>" or "mr/<slug>"). */
export function slugOf(a: Article): string {
  return a.id.split('/').pop()!;
}

/** Site-relative URL: English at /articles/<slug>/, Marathi at /mr/articles/<slug>/. */
export function articlePath(a: Article): string {
  return a.data.lang === 'mr' ? `/mr/articles/${slugOf(a)}/` : `/articles/${slugOf(a)}/`;
}

/** The other-language version is the article with the same web address. */
export async function findTranslation(a: Article): Promise<Article | undefined> {
  const other = a.data.lang === 'mr' ? 'en' : 'mr';
  return (await getArticles({ lang: other })).find((o) => slugOf(o) === slugOf(a));
}
