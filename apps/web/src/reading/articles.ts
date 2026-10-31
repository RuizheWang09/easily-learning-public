import type { ReadingArticle } from '@easily/core';
import readingCatalog from './reading-catalog.json';

export const catalogInfo = readingCatalog;

export const articles: ReadingArticle[] = [
  {
    id: 'morning-walk', title: 'A Morning Walk', description: 'Notice a small moment on the way home.',
    source: '易学原创', license: '原创示例内容', level: 'A1', genre: 'life', goals: ['general'],
    paragraphs: [
      'An ephemeral cloud passes over the quiet street. I leave home and begin a morning walk.',
      'A bird sings beside a small tree. The air is cool, and the sky is clear.',
      'I stop for a moment, then walk home. A short walk can make a new day feel bright.',
    ],
  },
  {
    id: 'small-garden', title: 'A Small Garden', description: 'A simple routine grows into a habit.',
    source: '易学原创', license: '原创示例内容', level: 'A2', genre: 'life', goals: ['general'],
    paragraphs: [
      'Mina keeps a small garden outside her window. Each morning, she checks the soil and gives the plants water.',
      'Some days are sunny, and some days bring rain. She learns to notice what each plant needs.',
      'After many weeks, the first flower opens. Mina shares it with her neighbor and smiles.',
    ],
  },
  {
    id: 'quiet-evening', title: 'A Quiet Evening', description: 'Making time to slow down after a busy day.',
    source: '易学原创', license: '原创示例内容', level: 'B1', genre: 'life', goals: ['general'],
    paragraphs: [
      'After a long day, Leo turns off his phone and opens a book. The room grows quiet as the city settles outside.',
      'He does not try to finish every chapter. Instead, he reads slowly and writes down one thought that surprises him.',
      'Before bed, Leo places the book on his desk. Tomorrow will be busy too, but this evening belongs to him.',
    ],
  },
  ...readingCatalog.articles as ReadingArticle[],
];
