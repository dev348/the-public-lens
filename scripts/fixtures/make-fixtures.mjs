// Generates fake Google Docs API responses for testing the sync offline:
//   node scripts/fixtures/make-fixtures.mjs <outDir>
//   node scripts/sync-drive.mjs --fixture <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const out = process.argv[2];
if (!out) throw new Error('usage: make-fixtures.mjs <outDir>');
mkdirSync(out, { recursive: true });

const run = (content, textStyle = {}) => ({ textRun: { content, textStyle } });
const para = (elements, paragraphStyle = { namedStyleType: 'NORMAL_TEXT' }, extra = {}) => ({
  paragraph: { elements: [...elements, run('\n')], paragraphStyle, ...extra },
});
const text = (t) => para([run(t)]);
const heading = (t, level = 2) => para([run(t)], { namedStyleType: `HEADING_${level}` });
const img = (id) => ({ inlineObjectElement: { inlineObjectId: id } });
const cell = (...paras) => ({ content: paras });
const row = (label, ...valueParas) => ({ tableCells: [cell(text(label)), cell(...valueParas)] });
const embedded = (uri, description = '') => ({ embeddedObject: { description, imageProperties: { contentUri: uri } } });

function metaTable(rows) {
  return { table: { rows: rows.length, columns: 2, tableRows: rows } };
}

// 1. Full-featured English article (Publish)
const english = {
  documentId: 'doc-en',
  title: 'Water and the weekly market',
  revisionId: 'r1',
  body: {
    content: [
      text('Fill in the table, then write your article below it.'),
      metaTable([
        row('Title / शीर्षक', text('Water, wages and the weekly market')),
        row('Web address / वेब पत्ता', text('water-and-the-weekly-market')),
        row('Language / भाषा', text('English')),
        row('Section / विभाग', text('Ground Stories')),
        row('Date / तारीख', text('18/11/2026')),
        row('Author / लेखक', text('Mithila Manohar Raut')),
        row('Summary / सारांश', text('A test article generated from a fixture.')),
        row('Main photo / मुख्य फोटो', para([img('kix.main')])),
        row('Photo description / फोटो वर्णन', text('Women at a village water tank')),
        row('Photo credit / फोटो श्रेय', text('Test credit')),
        row('Featured / मुख्य लेख', text('Yes')),
        row('Status / स्थिती', text('Publish')),
      ]),
      text('Every Thursday the market fills by seven in the morning.'),
      para([run('Prices are '), run('not ', { bold: true }), run('fixed', { bold: true, italic: true }), run(' here. Read the '), run('district ', { link: { url: 'https://example.org/report (2026)' } }), run('report', { bold: true, link: { url: 'https://example.org/report (2026)' } }), run(' for numbers.'), { footnoteReference: { footnoteId: 'fn1', footnoteNumber: '1' } }]),
      heading('What people told us'),
      para([run('"We walk four kilometres for water," said a farmer.')], { namedStyleType: 'NORMAL_TEXT', indentStart: { magnitude: 36, unit: 'PT' } }),
      para([run('Wages fell')], undefined, { bullet: { listId: 'bul', nestingLevel: 0 } }),
      para([run('Especially for women')], undefined, { bullet: { listId: 'bul', nestingLevel: 1 } }),
      para([run('Water prices rose')], undefined, { bullet: { listId: 'bul', nestingLevel: 0 } }),
      text(''),
      para([run('First step')], undefined, { bullet: { listId: 'num', nestingLevel: 0 } }),
      para([run('Second step')], undefined, { bullet: { listId: 'num', nestingLevel: 0 } }),
      para([img('kix.body')]),
      para([run('A photo set to wrap text sits next to this paragraph.')], undefined, { positionedObjectIds: ['kix.wrap'] }),
      text('# Not a heading, 5 * 3 = 15 and <b>not html</b>'),
      para([run('Sources / संदर्भ')], { namedStyleType: 'HEADING_2' }),
      para([run('District water report 2026', { link: { url: 'https://example.org/water' } })]),
      text('Interviews in the village, November 2026'),
    ],
  },
  footnotes: { fn1: { footnoteId: 'fn1', content: [text('Prices checked at three stalls.')] } },
  lists: {
    bul: { listProperties: { nestingLevels: [{ glyphSymbol: '●' }, { glyphSymbol: '○' }] } },
    num: { listProperties: { nestingLevels: [{ glyphType: 'DECIMAL' }] } },
  },
  inlineObjects: {
    'kix.main': { inlineObjectProperties: embedded('fixture:2400x1600:1e3157', 'Water tank') },
    'kix.body': { inlineObjectProperties: embedded('fixture:800x600:b48a3e', 'Market stalls') },
  },
  positionedObjects: {
    'kix.wrap': { positionedObjectProperties: embedded('fixture:600x400:625e57', 'Wrapped photo') },
  },
};

// 2. Marathi version with the same web address (Publish) – should pair with the English one
const marathi = {
  documentId: 'doc-mr',
  body: {
    content: [
      metaTable([
        row('Title / शीर्षक', text('पाणी, मजुरी आणि आठवडी बाजार')),
        row('Web address / वेब पत्ता', text('water-and-the-weekly-market')),
        row('Language / भाषा', text('मराठी')),
        row('Section / विभाग', text('जमिनीवरच्या गोष्टी')),
        row('Date / तारीख', text('१८/११/२०२६')),
        row('Author / लेखक', text('मिथिला मनोहर राऊत')),
        row('Summary / सारांश', text('फिक्स्चरमधून तयार झालेला चाचणी लेख.')),
        row('Main photo / मुख्य फोटो', text('(paste photo here)')),
        row('Status / स्थिती', text('प्रकाशित')),
      ]),
      text('दर गुरुवारी सकाळी सातपर्यंत बाजार भरतो.'),
      para([run('संदर्भ')], { namedStyleType: 'HEADING_2' }),
      text('गावातील मुलाखती, नोव्हेंबर २०२६'),
    ],
  },
};

// 3. Draft – must produce no files and not appear in the report
const draft = {
  documentId: 'doc-draft',
  body: {
    content: [
      metaTable([
        row('Title / शीर्षक', text('SECRET DRAFT TITLE')),
        row('Web address / वेब पत्ता', text('secret-draft')),
        row('Section / विभाग', text('Politics')),
        row('Status / स्थिती', text('Draft')),
      ]),
      text('Unfinished.'),
    ],
  },
};

// 4. Marked Publish but the section is wrong – should be reported, not published
const broken = {
  documentId: 'doc-broken',
  body: {
    content: [
      metaTable([
        row('Title / शीर्षक', text('An article with a typo in its section')),
        row('Web address / वेब पत्ता', text('typo-section')),
        row('Section / विभाग', text('Sports')),
        row('Date / तारीख', text('2026-11-19')),
        row('Status / स्थिती', text('Publish')),
      ]),
      text('Body text.'),
    ],
  },
};

const file = (id, name) => ({ id, name, modifiedTime: '2026-11-20T10:00:00.000Z', createdTime: '2026-11-17T08:00:00.000Z' });
const docs = [
  [file('doc-en', 'Water and the weekly market'), english],
  [file('doc-mr', 'पाणी आणि बाजार'), marathi],
  [file('doc-draft', 'Secret draft'), draft],
  [file('doc-broken', 'Broken section'), broken],
];
for (const [f, doc] of docs) writeFileSync(join(out, `${f.id}.json`), JSON.stringify({ file: f, doc }, null, 2));
console.log(`Wrote ${docs.length} fixtures to ${out}`);
