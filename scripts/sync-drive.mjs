#!/usr/bin/env node
// Syncs articles from a Google Drive folder of Google Docs into the website.
//
//   node scripts/sync-drive.mjs                     # real sync (needs the env vars below)
//   node scripts/sync-drive.mjs --fixture <dir>     # offline test using saved documents.get JSON
//
// Env:
//   GOOGLE_SERVICE_ACCOUNT  JSON key of a Google service account (GitHub secret)
//   DRIVE_FOLDER_ID         ID of the Drive folder that holds the article Docs (GitHub variable)
//   ALLOW_MASS_UNPUBLISH=1  allow removing more than MAX_REMOVALS articles in one run
//
// Only Docs whose Status is "Publish" are written. Nothing about drafts is ever written to the repo.

import { createSign } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { convertDoc, fileNameFor, toFrontmatter } from './gdocs-to-md.mjs';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const OUT_DIR = join(ROOT, 'src/content/gdocs');
const IMG_DIR = join(ROOT, 'public/uploads/gdocs');
const REPORT = join(ROOT, 'src/data/sync-report.json');
const MAX_REMOVALS = 3;
const MAX_IMAGE_WIDTH = 1600;

const args = process.argv.slice(2);
const fixtureDir = args.includes('--fixture') ? resolve(args[args.indexOf('--fixture') + 1]) : null;

const log = (...m) => console.log(...m);
const notice = (m) => console.log(`::notice::${m}`);
const warn = (m) => console.log(`::warning::${m}`);

// ---------------- Google API access ----------------

async function getAccessToken(credsJson) {
  let creds;
  try {
    creds = JSON.parse(credsJson);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT is not valid JSON. Paste the whole key file content into the secret.');
  }
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/documents.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(creds.private_key).toString('base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
  });
  if (!res.ok) throw new Error(`Google sign-in failed (${res.status}): ${await res.text()}`);
  return { token: (await res.json()).access_token, email: creds.client_email };
}

async function api(token, url) {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Google API ${res.status} for ${url.split('?')[0]}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

/** All Google Docs in the folder and its subfolders. Throws on any API error. */
async function listDocs(token, folderId) {
  const docs = [];
  const queue = [folderId];
  const seenFolders = new Set();
  while (queue.length) {
    const parent = queue.shift();
    if (seenFolders.has(parent)) continue;
    seenFolders.add(parent);
    let pageToken;
    do {
      const q = `'${parent}' in parents and trashed = false and (mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.google-apps.folder')`;
      const params = new URLSearchParams({
        q,
        fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, createdTime)',
        pageSize: '200',
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const data = await api(token, `https://www.googleapis.com/drive/v3/files?${params}`);
      for (const f of data.files ?? []) {
        if (f.mimeType === 'application/vnd.google-apps.folder') queue.push(f.id);
        else docs.push(f);
      }
      pageToken = data.nextPageToken;
    } while (pageToken);
  }
  return docs;
}

const getDoc = (token, id) =>
  api(token, `https://docs.googleapis.com/v1/documents/${id}?suggestionsViewMode=PREVIEW_WITHOUT_SUGGESTIONS`);

async function downloadImage(token, uri) {
  if (uri.startsWith('fixture:')) {
    // fixture:<width>x<height>:<hex colour>
    const [, size, color] = uri.split(':');
    const [width, height] = size.split('x').map(Number);
    return sharp({ create: { width, height, channels: 3, background: `#${color}` } }).png().toBuffer();
  }
  let res = await fetch(uri, { headers: { authorization: `Bearer ${token}` } });
  if (!res.ok) res = await fetch(uri); // some contentUris are pre-signed and reject extra auth
  if (!res.ok) throw new Error(`Image download failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
}

/** Resize for the web and strip all metadata (EXIF / GPS location). */
const processImage = (buf) =>
  sharp(buf)
    .rotate() // apply EXIF orientation before metadata is dropped
    .resize({ width: MAX_IMAGE_WIDTH, withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

// ---------------- existing synced articles ----------------

function readExisting() {
  if (!existsSync(OUT_DIR)) return [];
  return readdirSync(OUT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const text = readFileSync(join(OUT_DIR, file), 'utf8');
      const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
      const get = (k) => {
        const m = fm.match(new RegExp(`^${k}: (.*)$`, 'm'));
        if (!m) return undefined;
        try { return JSON.parse(m[1]); } catch { return m[1]; }
      };
      return { file, key: file.replace(/\.md$/, ''), gdocId: get('gdocId'), gdocModified: get('gdocModified'), title: get('title') };
    })
    .filter((e) => e.gdocId); // only ever touch files created by this sync
}

function removeArticle(key) {
  rmSync(join(OUT_DIR, `${key}.md`), { force: true });
  rmSync(join(IMG_DIR, key), { recursive: true, force: true });
}

// ---------------- main ----------------

async function main() {
  let token = '';
  let files;
  let fixtures = new Map();

  if (fixtureDir) {
    for (const f of readdirSync(fixtureDir).filter((x) => x.endsWith('.json'))) {
      const fx = JSON.parse(readFileSync(join(fixtureDir, f), 'utf8'));
      fixtures.set(fx.file.id, fx);
    }
    files = [...fixtures.values()].map((fx) => fx.file);
    log(`Fixture mode: ${files.length} document(s) from ${fixtureDir}`);
  } else {
    const creds = process.env.GOOGLE_SERVICE_ACCOUNT;
    const folderId = process.env.DRIVE_FOLDER_ID;
    if (!creds || !folderId) {
      notice('Google Docs sync is not set up yet (GOOGLE_SERVICE_ACCOUNT secret or DRIVE_FOLDER_ID variable missing). Skipping.');
      return;
    }
    const auth = await getAccessToken(creds);
    token = auth.token;
    log(`Signed in to Google as ${auth.email}`);
    files = await listDocs(token, folderId.trim());
    log(`Found ${files.length} Google Doc(s) in the articles folder.`);
  }

  const existing = readExisting();

  // Guard: an empty listing while articles exist almost always means lost access, not "delete everything".
  if (files.length === 0 && existing.length > 0) {
    throw new Error(
      `The Drive folder looks empty, but ${existing.length} article(s) were published from it. ` +
        'Check that the folder is still shared with the service account. Nothing was changed.',
    );
  }

  const problems = [];
  const keep = new Set(); // keys of articles that stay
  const written = [];
  const usedKeys = new Map(); // key -> doc name

  for (const file of files) {
    const prev = existing.find((e) => e.gdocId === file.id);

    // Unchanged since last sync: keep as is.
    if (prev && prev.gdocModified === file.modifiedTime) {
      keep.add(prev.key);
      usedKeys.set(prev.key, file.name);
      continue;
    }

    let doc;
    try {
      doc = fixtureDir ? fixtures.get(file.id).doc : await getDoc(token, file.id);
    } catch (e) {
      // Can't read it right now: keep any published version and report it.
      if (prev) keep.add(prev.key);
      // Log the ID only: this may be a draft, and Actions logs are public.
      warn(`Could not read Doc ${file.id}: ${e.message}`);
      continue;
    }

    const probe = convertDoc(doc, { createdTime: file.createdTime });
    if (probe.status !== 'publish') continue; // drafts: write nothing at all

    const key = `${probe.article.lang}-${probe.article.slug || 'untitled'}`;
    if (probe.errors.length) {
      if (prev) keep.add(prev.key); // keep the last good version online
      problems.push({ title: probe.article.title || file.name, reasons: probe.errors });
      continue;
    }
    if (usedKeys.has(key) && usedKeys.get(key) !== file.name) {
      if (prev) keep.add(prev.key);
      problems.push({
        title: probe.article.title,
        reasons: [`The web address "${probe.article.slug}" is already used by "${usedKeys.get(key)}". Choose a different one.`],
      });
      continue;
    }

    // Convert again with the final image folder.
    const imageBase = `/uploads/gdocs/${key}`;
    const result = convertDoc(doc, { imageBase, createdTime: file.createdTime });

    // Images: download into a temporary folder, swap in only if every photo succeeded,
    // so a failed download never breaks the version that is already online.
    const imgFolder = join(IMG_DIR, key);
    const tmpFolder = join(IMG_DIR, `.tmp-${key}`);
    rmSync(tmpFolder, { recursive: true, force: true });
    let imageFailed = false;
    if (result.images.length) mkdirSync(tmpFolder, { recursive: true });
    for (const img of result.images) {
      try {
        const buf = await processImage(await downloadImage(token, img.contentUri));
        writeFileSync(join(tmpFolder, fileNameFor(img.objectId)), buf);
      } catch (e) {
        imageFailed = true;
        warn(`Photo in "${result.article.title}" failed: ${e.message}`);
      }
    }
    if (imageFailed) {
      rmSync(tmpFolder, { recursive: true, force: true });
      if (prev) keep.add(prev.key);
      problems.push({ title: result.article.title, reasons: ['A photo could not be downloaded. It will be retried on the next sync.'] });
      continue;
    }
    rmSync(imgFolder, { recursive: true, force: true });
    if (result.images.length) renameSync(tmpFolder, imgFolder);

    const fm = toFrontmatter({
      ...result.article,
      gdocId: file.id,
      gdocModified: file.modifiedTime,
    });
    mkdirSync(OUT_DIR, { recursive: true });
    writeFileSync(join(OUT_DIR, `${key}.md`), `${fm}\n\n${result.body}`);
    if (prev && prev.key !== key) removeArticle(prev.key); // web address or language changed
    keep.add(key);
    usedKeys.set(key, file.name);
    written.push(result.article.title);
  }

  // Articles whose Doc was deleted, moved out of the folder, or set back to Draft.
  const toRemove = existing.filter((e) => !keep.has(e.key));
  if (toRemove.length > MAX_REMOVALS && process.env.ALLOW_MASS_UNPUBLISH !== '1') {
    throw new Error(
      `This sync would remove ${toRemove.length} articles at once (${toRemove.map((e) => e.title).join('; ')}). ` +
        'That looks like a mistake, so nothing was changed. If it is intended, run the workflow with "Allow removing many articles" ticked.',
    );
  }
  for (const e of toRemove) removeArticle(e.key);

  // Status report (public): only problems with Docs marked Publish. Rewritten only when it changes.
  const report = { problems };
  const prevReport = existsSync(REPORT) ? JSON.parse(readFileSync(REPORT, 'utf8')) : null;
  if (JSON.stringify(prevReport?.problems ?? []) !== JSON.stringify(problems)) {
    mkdirSync(join(ROOT, 'src/data'), { recursive: true });
    writeFileSync(REPORT, `${JSON.stringify({ ...report, updatedAt: new Date().toISOString() }, null, 2)}\n`);
  }

  log(`Published or updated: ${written.length ? written.join('; ') : 'none'}`);
  log(`Removed: ${toRemove.length ? toRemove.map((e) => e.title).join('; ') : 'none'}`);
  if (problems.length) {
    for (const p of problems) warn(`Not published: "${p.title}": ${p.reasons.join(' ')}`);
  }
}

main().catch((e) => {
  console.error(`::error::${e.message}`);
  process.exit(1);
});
