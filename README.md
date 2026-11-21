# The Public Lens

Independent writing in English and Marathi. *Understanding society. Questioning power. Amplifying voices.*

- **Website:** an [Astro](https://astro.build) static site, hosted free on GitHub Pages.
- **Editor:** [Pages CMS](https://pagescms.org). Mithila writes and publishes from the browser, with no code involved.
- **Search:** [Pagefind](https://pagefind.app). One search box covers English and Marathi.
- **Backups:** every save is a git commit, so all history is kept and any version can be restored.
- **Security:** plain static pages, with no server, database or login page to attack.

---

## For Mithila: publishing an article

1. Go to **https://app.pagescms.org** and sign in with GitHub.
2. Open the **the-public-lens** repository, then **Articles / लेख**.
3. Click **Add an entry** and fill in:
   - **Title**, **Web address**, **Short summary**
   - **Language** (English / मराठी) and **Section**
   - **Publish date**, **Author**, **Main photo** (+ description and credit)
   - **Sources**: add one row per source
   - The article text, in the big editor box (you can paste from Google Docs)
4. Leave **Draft** ticked while you work. **Untick Draft** and **Save** to publish.
5. The site updates by itself in about a minute.

**Linking English ↔ Marathi versions:** give both versions the **same Web address**, for example `farmers-protest`. A "वाचा मराठीत / Read in English" link then appears on both.

**Photos:** upload them through the photo field or the editor's image button. Keep each photo under about 2 MB. Resize big phone photos first.

---

## One-time setup (for whoever manages the site)

1. Create a GitHub repo (e.g. `the-public-lens`) and push this folder to the `main` branch.
2. In the repo, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Add Mithila as a collaborator: **Settings → Collaborators**.
4. Mithila signs in at app.pagescms.org with GitHub. Install the Pages CMS GitHub app on the repo when asked.
5. Optional: add a custom domain such as `thepubliclens.in` in **Settings → Pages**. The workflow picks the right base path automatically.

Private drafts, notes and research material stay in Google Drive or a separate **private** repo. Everything in this repo's `main` branch that isn't marked Draft is published.

### Things to fill in

- `src/lib/site.ts`: contact email and social links
- `src/lib/site.ts` → `newsletter.action`: the signup form shows "launching soon" until this is set.
  The easiest option is [Buttondown](https://buttondown.com), free for up to 100 subscribers. Create an account, then set
  `action: 'https://buttondown.com/api/emails/embed-subscribe/<username>'`. Signups are tagged
  `english` or `marathi` depending on the page they came from. For Mailchimp, paste its embed-form
  action URL and set `emailField: 'EMAIL'`.
- `src/lib/site.ts` → `whatsapp.channel` (WhatsApp Channel link) and `whatsapp.number` (for story tips).
  Both stay hidden until filled in. They add a "Follow on WhatsApp" button, a footer link and a Contact-page option.
- `src/lib/authors.ts`: author bios for the box at the end of each article. Add Mithila's photo as
  `public/uploads/mithila.jpg` and set `photo: '/uploads/mithila.jpg'`. Check the Marathi bio wording.
- `src/pages/standards.astro`: read the whole "Our standards" page and fill in the **Funding** paragraph (dashed box).
- Delete the four `[Sample]` articles in `src/content/articles/` once real ones exist

## Running locally

```bash
npm install
npm run dev        # http://localhost:4321 (search only works after a build)
npm run build      # builds to dist/ and creates the search index
npm run preview
```

## Project layout

```
.pages.yml                   # editor (Pages CMS) fields
.github/workflows/deploy.yml # build + publish to GitHub Pages on every push
src/content/articles/        # articles (Markdown), English and Marathi
src/lib/site.ts              # site name, sections, contact info, UI labels
src/pages/                   # Home, sections, Marathi, About, Contact, Search, article pages
public/uploads/              # photos uploaded from the editor
```
