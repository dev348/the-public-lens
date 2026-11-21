import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getArticles, articlePath } from '../lib/articles';
import { SITE, url } from '../lib/site';

export async function GET(context: APIContext) {
  const articles = await getArticles();
  return rss({
    title: SITE.name,
    description: SITE.description,
    site: new URL(url('/'), context.site).href,
    xmlns: { dc: 'http://purl.org/dc/elements/1.1/' },
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.description,
      pubDate: a.data.date,
      customData: `<dc:creator><![CDATA[${a.data.author}]]></dc:creator>`,
      link: url(articlePath(a)),
    })),
  });
}
