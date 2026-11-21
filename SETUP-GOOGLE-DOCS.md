# Publishing from Google Docs

Mithila writes each article as a Google Doc in one Drive folder. Every 15 minutes the website
checks that folder. Docs with **Status: Publish** appear on the site (photos included), and Docs set
back to **Draft**, deleted, or moved out of the folder are taken down.

```
Google Drive folder ──(every 15 min)──▶ GitHub Action ──▶ article files in the repo ──▶ website
"The Public Lens – Articles"            "Sync articles from Google Docs"                 (deploys automatically)
```

- **Folder:** [The Public Lens – Articles](https://drive.google.com/drive/folders/10ea-FM8diqjN3rAR9QIWAIVO_OI24TeJ)
- **Template:** [Article template / लेख नमुना](https://docs.google.com/document/d/1UJENvXEqZdB3yyZF-y8KF27rc9RtOSi3qw8f15LY7NM/edit)
  (a copy of the template is also in [`docs/article-template.html`](docs/article-template.html): upload it to Drive to recreate it)
- **Is something not showing up?** Open `/sync-status/` on the website (for example
  `https://dev348.github.io/the-public-lens/sync-status/`). It lists every Doc marked Publish that couldn't be published, and why.

---

## For Mithila: writing and publishing

1. Open the **Article template**, then choose **File → Make a copy** and keep the copy in the same folder.
2. Fill in the table at the top:
   | Row | What to write |
   |---|---|
   | Title | The headline |
   | Web address | A few English words with dashes, e.g. `farmers-protest-explained`. **Use the same web address for the English and Marathi versions** so they link to each other. |
   | Language | `English` or `मराठी` |
   | Section | Politics, Society, Education & Development, Ground Stories, or Ideas & Books (English or Marathi name) |
   | Date | e.g. `21/11/2026` (day first) |
   | Summary | One or two sentences, shown on the home page and in WhatsApp previews |
   | Main photo | Paste the photo into this cell |
   | Photo description / credit | What the photo shows, who took it |
   | Featured | `Yes` to put it at the top of the home page |
   | Status | `Draft` while writing, then `Publish` |
3. Write the article under the table. These all carry over to the site:
   - **Heading 2** for subheadings
   - **bold**, *italic*, links, bulleted and numbered lists
   - photos (Insert → Image; set them to **In line**)
   - pull quotes (indent the paragraph with Format → Align & indent → Increase indent)
   - footnotes (Insert → Footnote)
4. Under **Sources / संदर्भ**, write one source per line, with the link on the source name.
5. Change **Status** to **Publish**. The article appears within about 15 minutes (GitHub sometimes runs a few minutes late).
6. To edit a published article, just edit the Doc. Changes appear on the next check.
7. To take an article down, change Status to **Draft** (or delete the Doc).

Tips:
- Lines starting with ✎ are notes and are never published.
- Suggestions (suggested edits) are **not** published until they are accepted.
- Keep each article in one tab of the Doc.
- Get consent before publishing photos of people. Location data inside photos is removed automatically.
- **Removing an article takes it off the website, but this repository is public and keeps its history.**
  Anyone who looks at old versions on GitHub can still find it. Publish only what you are prepared to have on record.

---

## One-time setup (about 15 minutes, done once by whoever manages the site)

The website reads the folder with a Google **service account**: a robot Google account that can only
*view* the folder you share with it. Its key is stored as a GitHub secret and never written in the code.

> **Use a personal Google account for steps 1–2** (for example Mithila's own Gmail). Work or school
> Google accounts often block creating service-account keys, or sharing folders with accounts outside
> the organisation. Long term, the articles folder should belong to Mithila's own Google account. If step 3 fails, move the folder to a personal account's Drive
> and share it from there.

### 1. Create the Google Cloud project and turn on the APIs
1. Go to <https://console.cloud.google.com/> and sign in.
2. Use the project picker at the top → **New project** → name it `the-public-lens` → **Create**.
3. Open **APIs & Services → Library**. Search for and **Enable** both of these:
   - **Google Drive API**
   - **Google Docs API**

### 2. Create the service account and its key
1. Open **IAM & Admin → Service Accounts → Create service account**.
2. Name: `docs-sync`. Then click **Create and continue → Done**. It needs no roles.
3. Click the new account, open the **Keys** tab, choose **Add key → Create new key → JSON**, then **Create**.
   A `.json` file downloads.
4. Copy the account's email address, which looks like `docs-sync@the-public-lens-xxxx.iam.gserviceaccount.com`.

### 3. Share the articles folder with it
In Google Drive, right-click **The Public Lens – Articles** → **Share**, then paste the service account email
and set it to **Viewer**. Untick "Notify people", then click **Share**.
(Also share the folder with Mithila as **Editor** if it isn't in her Drive.)

### 4. Give the key and folder to GitHub
In the GitHub repo, go to **Settings → Secrets and variables → Actions**:
1. **Secrets** tab → **New repository secret**
   - Name: `GOOGLE_SERVICE_ACCOUNT`
   - Value: open the downloaded `.json` file in a text editor and paste **all** of its contents
2. **Variables** tab → **New repository variable**
   - Name: `DRIVE_FOLDER_ID`
   - Value: `10ea-FM8diqjN3rAR9QIWAIVO_OI24TeJ` (the part of the folder's URL after `/folders/`)
3. Delete the downloaded `.json` file from your computer. GitHub now holds the only copy you need.

### 5. Test it
1. Make a copy of the template, fill it in, and set Status to **Publish**.
2. In GitHub, open **Actions → Sync articles from Google Docs → Run workflow**.
3. When it finishes (about 1 minute), the **Publish website** workflow starts by itself, and the article is live about a minute later.

---

## How it behaves (for the maintainer)

- **What runs:** `.github/workflows/sync-google-docs.yml` runs every 15 minutes and on demand, using `scripts/sync-drive.mjs`.
  Changes are committed to `src/content/gdocs/` and `public/uploads/gdocs/`, then the deploy workflow is started.
- **Not set up yet?** The workflow just prints a notice and exits successfully, so there are no failure emails.
- **Drafts:** nothing from a Draft Doc is ever written to the repository.
- **Logs are public.** GitHub Actions logs of a public repo can be read by anyone. The sync logs titles only for
  Docs marked Publish, and refers to other Docs only by their ID.
- **Safety:** if the folder suddenly looks empty (for example, sharing was removed), or a run would remove more than 3 articles at once,
  the sync stops and changes nothing. To remove many articles intentionally, run the workflow by hand with
  **"Allow removing many articles"** ticked.
- **Failed photos or a broken Doc:** the last good version stays online and the problem is listed on `/sync-status/`.
- **Photos:** resized to at most 1600px wide, saved as JPEG, and stripped of all metadata, including GPS location.
- **Articles written in the site editor (Pages CMS)** live in `src/content/articles/` and are never touched by the sync.
  Articles from Google Docs should be edited only in Google Docs, because the sync overwrites them.
- **GitHub pauses scheduled workflows** in public repos after 60 days with no repository activity. If the
  site stops updating after a long break, open **Actions → Sync articles from Google Docs → Enable workflow**.
- **Offline test:**
  ```bash
  node scripts/fixtures/make-fixtures.mjs /tmp/gdocs-fixtures && node scripts/sync-drive.mjs --fixture /tmp/gdocs-fixtures
  ```
  This writes test articles into `src/content/gdocs/`. Delete them afterwards.
