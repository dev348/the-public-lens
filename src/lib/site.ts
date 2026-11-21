export const SITE = {
  name: 'The Public Lens',
  tagline: 'Understanding society. Questioning power. Amplifying voices.',
  taglineMr: 'समाज समजून घेऊ. सत्तेला प्रश्न विचारू. लोकांचा आवाज पोहोचवू.',
  description:
    'An independent writing platform in English and Marathi on politics, society, development and the everyday lives of people.',
  // TODO: replace with the real contact email and social links.
  email: 'hello@example.com',
  social: [] as { label: string; url: string }[],
  /**
   * Newsletter signup. The form posts straight to the newsletter service.
   * Buttondown (free up to 100 subscribers): set `action` to
   *   https://buttondown.com/api/emails/embed-subscribe/<your-username>
   * Mailchimp: paste the form "action" URL from its embedded-form code and set emailField to "EMAIL".
   * Leave `action` empty until an account exists; the form then shows "coming soon".
   */
  newsletter: {
    action: '',
    emailField: 'email',
  },
};

export const CATEGORY_SLUGS = [
  'politics',
  'society',
  'education-development',
  'ground-stories',
  'ideas-books',
] as const;
export type CategorySlug = (typeof CATEGORY_SLUGS)[number];

export const CATEGORIES: Record<
  CategorySlug,
  { en: string; mr: string; blurb: string }
> = {
  politics: {
    en: 'Politics',
    mr: 'राजकारण',
    blurb: "Elections, government, public decisions and people's rights.",
  },
  society: {
    en: 'Society',
    mr: 'समाज',
    blurb: 'Caste, gender, tribal communities, workers and social issues.',
  },
  'education-development': {
    en: 'Education & Development',
    mr: 'शिक्षण आणि विकास',
    blurb: 'Schools, health, jobs, migration and village development.',
  },
  'ground-stories': {
    en: 'Ground Stories',
    mr: 'जमिनीवरच्या गोष्टी',
    blurb: 'Experiences and concerns of people from villages, towns and cities.',
  },
  'ideas-books': {
    en: 'Ideas & Books',
    mr: 'विचार आणि पुस्तके',
    blurb: 'Opinions, explainers, book reviews and reflections.',
  },
};

export const UI = {
  en: {
    latest: 'Latest',
    readMore: 'Read',
    by: 'By',
    sources: 'Sources',
    share: 'Share',
    copyLink: 'Copy link',
    copied: 'Link copied',
    readIn: 'वाचा मराठीत',
    search: 'Search',
    allArticles: 'All articles',
    noArticles: 'No articles yet. New writing is on the way.',
    updated: 'Updated',
  },
  mr: {
    latest: 'नवीन लेख',
    readMore: 'वाचा',
    by: 'लेखक',
    sources: 'संदर्भ',
    share: 'शेअर करा',
    copyLink: 'लिंक कॉपी करा',
    copied: 'लिंक कॉपी झाली',
    readIn: 'Read in English',
    search: 'शोधा',
    allArticles: 'सर्व लेख',
    noArticles: 'अजून लेख नाहीत. लवकरच नवीन लेखन येत आहे.',
    updated: 'अद्यतनित',
  },
} as const;

/** Prefix a site-relative path with the deploy base (needed on GitHub Pages project sites). */
export function url(path = '/'): string {
  if (/^(https?:|mailto:|#)/.test(path)) return path;
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${base}${clean}` || '/';
}

export function formatDate(d: Date, lang: 'en' | 'mr' = 'en'): string {
  return d.toLocaleDateString(lang === 'mr' ? 'mr-IN' : 'en-IN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

export function readingMinutes(body = ''): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}
