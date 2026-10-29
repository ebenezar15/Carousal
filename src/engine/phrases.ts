// Fixed phrases the built-in rules add to a carousel (CTA, hook subline, recap title), in the content's
// own language, plus a script-based language guess for content typed without a language setting.

export interface Phrases {
  ctaHeadline: string;
  ctaBody: string;
  /** `{n}` is replaced by the number of content slides. */
  ideas: string;
  recap: string;
}

const PHRASES: Record<string, Phrases> = {
  en: { ctaHeadline: 'Found this useful?', ctaBody: 'Save it for later and share it with someone who needs it.', ideas: '{n} ideas worth saving', recap: 'Quick recap' },
  ta: { ctaHeadline: 'இது பயனுள்ளதாக இருந்ததா?', ctaBody: 'பின்னர் படிக்கச் சேமித்து, தேவைப்படுபவருடன் பகிருங்கள்.', ideas: 'சேமிக்க வேண்டிய {n} குறிப்புகள்', recap: 'சுருக்கமாக' },
  hi: { ctaHeadline: 'क्या यह उपयोगी लगा?', ctaBody: 'इसे बाद के लिए सेव करें और किसी ज़रूरतमंद के साथ शेयर करें।', ideas: 'सेव करने लायक {n} बातें', recap: 'संक्षेप में' },
  es: { ctaHeadline: '¿Te resultó útil?', ctaBody: 'Guárdalo para después y compártelo con quien lo necesite.', ideas: '{n} ideas para guardar', recap: 'En resumen' },
  fr: { ctaHeadline: 'Utile ?', ctaBody: 'Enregistrez-le pour plus tard et partagez-le avec quelqu’un qui en a besoin.', ideas: '{n} idées à garder', recap: 'En bref' },
  de: { ctaHeadline: 'Hilfreich?', ctaBody: 'Speichere es für später und teile es mit jemandem, der es braucht.', ideas: '{n} Ideen zum Merken', recap: 'Kurz zusammengefasst' },
  pt: { ctaHeadline: 'Isso foi útil?', ctaBody: 'Salve para depois e compartilhe com quem precisa.', ideas: '{n} ideias para salvar', recap: 'Resumo rápido' },
  it: { ctaHeadline: 'Ti è stato utile?', ctaBody: 'Salvalo per dopo e condividilo con chi ne ha bisogno.', ideas: '{n} idee da salvare', recap: 'In breve' },
  ar: { ctaHeadline: 'هل كان هذا مفيدًا؟', ctaBody: 'احفظه لوقت لاحق وشاركه مع من يحتاجه.', ideas: '{n} أفكار تستحق الحفظ', recap: 'باختصار' },
  ru: { ctaHeadline: 'Было полезно?', ctaBody: 'Сохраните на потом и поделитесь с тем, кому это нужно.', ideas: '{n} идей, которые стоит сохранить', recap: 'Коротко' },
  ja: { ctaHeadline: '役に立ちましたか？', ctaBody: '保存して、必要な人にシェアしてください。', ideas: '保存したい{n}のポイント', recap: 'まとめ' },
  zh: { ctaHeadline: '觉得有用吗？', ctaBody: '收藏起来，分享给需要的人。', ideas: '{n} 个值得收藏的要点', recap: '快速回顾' },
  ko: { ctaHeadline: '도움이 되셨나요?', ctaBody: '저장해 두고 필요한 사람에게 공유하세요.', ideas: '저장할 만한 {n}가지', recap: '요약' },
};

export const phrasesFor = (lang: string): Phrases => PHRASES[lang.split('-')[0]!.toLowerCase()] ?? PHRASES.en!;

const SCRIPTS: [RegExp, string][] = [
  [/[஀-௿]/g, 'ta'], [/[ऀ-ॿ]/g, 'hi'], [/[ঀ-৿]/g, 'bn'], [/[ఀ-౿]/g, 'te'], [/[ಀ-೿]/g, 'kn'],
  [/[ഀ-ൿ]/g, 'ml'], [/[઀-૿]/g, 'gu'], [/[਀-੿]/g, 'pa'], [/[඀-෿]/g, 'si'], [/[؀-ۿ]/g, 'ar'],
  [/[֐-׿]/g, 'he'], [/[Ѐ-ӿ]/g, 'ru'], [/[Ͱ-Ͽ]/g, 'el'], [/[฀-๿]/g, 'th'], [/[가-힯]/g, 'ko'],
  [/[぀-ヿ]/g, 'ja'], [/[一-鿿]/g, 'zh'],
];

/** Best guess of the content language from its script (Latin-script text is reported as English). */
export function detectLanguage(text: string): string {
  const letters = (text.match(/\p{L}/gu) ?? []).length || 1;
  let best = { lang: 'en', count: 0 };
  for (const [re, lang] of SCRIPTS) {
    const count = (text.match(re) ?? []).length;
    // Japanese text mixes kana and kanji: any kana means Japanese.
    if (lang === 'ja' && count > 0 && count / letters > 0.05) return 'ja';
    if (count > best.count) best = { lang, count };
  }
  return best.count / letters > 0.3 ? best.lang : 'en';
}
