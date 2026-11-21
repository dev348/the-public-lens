import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getArticles, articlePath } from '../lib/articles';
import { SITE, url } from '../lib/site';

export async function GET(context: APIContext) {
  const articles = await getArticles();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: context.site!,
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      pubDate: a.data.date,
      author: a.data.author,
      link: url(articlePath(a)),
    })),
  });
}
