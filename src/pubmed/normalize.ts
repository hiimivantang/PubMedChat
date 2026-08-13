import type { Article } from './types';

export function normalizePmid(value: string): string {
  return value.trim().replace(/[^0-9]/g, '');
}

export function pubmedUrl(pmid: string): string {
  return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
}

export function abstractExcerpt(abstractText: string, maxLength = 320): string {
  const compact = abstractText.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }

  return `${compact.slice(0, maxLength).replace(/[\s,.;:]+$/, '')}...`;
}

export function articleYear(
  article: Pick<Article, 'publicationDate'>,
): number | null {
  const match = article.publicationDate.match(/\d{4}/);
  return match ? Number(match[0]) : null;
}

export function uniqueStrings(
  values: Array<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => value?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  );
}
