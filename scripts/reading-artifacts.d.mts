export function normalizeParagraph(paragraph: string): string;
export function compatibleReadingBody(expected: string, existing: string): boolean;
export function reconcileBodyMetadata(catalogV2: string, content: string): string;
export function articleContentVersion(articleId: string, paragraphs: readonly string[]): string;
export function buildPublishedArtifacts(catalog: {
  generatedAt: string; checkedAt?: string; warnings?: string[];
  articles?: { id: string; paragraphs?: string[]; license?: string; credit?: string; [key: string]: unknown }[];
}): { catalogV2: string; bodies: { path: string; content: string }[] };
