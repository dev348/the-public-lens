// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// SITE_URL and BASE_PATH are set by the GitHub Pages workflow.
// With a custom domain later, set BASE_PATH to "/" and SITE_URL to the domain.
const base = process.env.BASE_PATH || '/';

/**
 * Images uploaded through the editor are saved as "/uploads/…". On a GitHub Pages
 * project site the site lives under "/<repo>/", so prefix root-relative links and
 * images inside article bodies with the base path.
 */
function rehypePrefixBase() {
  const prefix = base.replace(/\/$/, '');
  /** @param {any} node */
  const walk = (node) => {
    if (prefix && node.type === 'raw' && typeof node.value === 'string') {
      // Raw HTML pasted into an article, e.g. <img src="/uploads/x.jpg">
      node.value = node.value.replace(
        /\b(src|href)=(["'])\/(?!\/)/g,
        (/** @type {string} */ m, /** @type {string} */ attr, /** @type {string} */ q, /** @type {number} */ i, /** @type {string} */ str) =>
          str.startsWith(prefix.slice(1) + '/', i + m.length) ? m : `${attr}=${q}${prefix}/`,
      );
    }
    if (node.type === 'element') {
      for (const attr of ['src', 'href']) {
        const v = node.properties?.[attr];
        if (prefix && typeof v === 'string' && v.startsWith('/') && !v.startsWith('//') && !v.startsWith(prefix + '/')) {
          node.properties[attr] = prefix + v;
        }
      }
    }
    node.children?.forEach(walk);
  };
  return /** @param {any} tree */ (tree) => walk(tree);
}

export default defineConfig({
  site: process.env.SITE_URL || 'https://example.github.io',
  base,
  trailingSlash: 'ignore',
  integrations: [sitemap({ filter: (page) => !page.includes('/sync-status') })],
  markdown: { rehypePlugins: [rehypePrefixBase] },
});
