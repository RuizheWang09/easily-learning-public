import type { ImportedArticle } from './voa';

const exams = ['ielts', 'cet4', 'cet6'] as const;
export function classifyArticle(
  article: Pick<ImportedArticle, 'paragraphs' | 'genre'> & { level?: string },
  lexicon: Map<string, readonly string[]>, forms: Map<string, string>,
) {
  const tokens = article.paragraphs.join(' ').toLowerCase().match(/[a-z]+(?:['’-][a-z]+)*/g) ?? [];
  const lemmas = new Set(tokens.map((token) => lexicon.has(token) ? token : forms.get(token) ?? token));
  const examVocabulary = { ielts: 0, cet4: 0, cet6: 0 };
  for (const word of lemmas) for (const exam of exams) {
    if (lexicon.get(word)?.includes(exam)) examVocabulary[exam]++;
  }
  const goals: NonNullable<ImportedArticle['goals']> = ['general'];
  const information = ['science', 'news'].includes(article.genre ?? 'news');
  // 拓展阅读的产品规则，不是考试难度认证。小说保留在通用英语分类。
  const suitable = {
    ielts: information && tokens.length >= 400 && tokens.length <= 1600,
    cet4: article.genre !== 'fiction' && article.level !== 'B2' && tokens.length >= 120 && tokens.length <= 750,
    cet6: information && tokens.length >= 350 && tokens.length <= 1600,
  };
  for (const exam of exams) {
    if (suitable[exam] && examVocabulary[exam] >= 8 && examVocabulary[exam] / Math.max(1, lemmas.size) >= 0.08) goals.push(exam);
  }
  return { wordCount: tokens.length, goals, examVocabulary, genre: article.genre ?? 'news' as const };
}
