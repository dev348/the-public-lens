/**
 * Author profiles shown in the box at the end of each article.
 * Match on any of `names` (English or Marathi spelling, as typed in the editor).
 * `photo`: upload a square photo to public/uploads/ and put its path here, e.g. '/uploads/mithila.jpg'.
 */
export interface Author {
  names: string[];
  initials: string;
  photo?: string;
  role: { en: string; mr: string };
  bio: { en: string; mr: string };
}

export const AUTHORS: Author[] = [
  {
    names: ['Mithila Manohar Raut', 'मिथिला मनोहर राऊत'],
    initials: 'MR',
    photo: undefined,
    role: { en: 'Founder and Editor', mr: 'संस्थापक आणि संपादक' },
    bio: {
      en: 'Independent writer and researcher interested in politics, society, democracy and development, with an academic background in Economics and Development Management and experience in development work and grassroots research.',
      // TODO: Mithila to review the Marathi wording.
      mr: 'राजकारण, समाज, लोकशाही आणि विकास या विषयांत रस असलेल्या स्वतंत्र लेखिका आणि संशोधक. अर्थशास्त्र आणि विकास व्यवस्थापनाचे शिक्षण, तसेच विकास क्षेत्रातील काम आणि तळागाळातील संशोधनाचा अनुभव.',
    },
  },
];

export function findAuthor(name: string): Author | undefined {
  const n = name.trim().toLowerCase();
  return AUTHORS.find((a) => a.names.some((x) => x.toLowerCase() === n));
}
