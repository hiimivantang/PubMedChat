import { articleYear } from './normalize';
import type { Article, ArticleSearchResult, SearchFilters } from './types';

const TOKEN_PATTERN = /[a-z0-9]+/gi;
const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'for',
  'from',
  'how',
  'in',
  'is',
  'of',
  'on',
  'or',
  'the',
  'to',
  'what',
  'with',
]);

export function queryTerms(query: string): string[] {
  const terms = query.toLowerCase().match(TOKEN_PATTERN) ?? [];
  return Array.from(new Set(terms.filter((term) => !STOP_WORDS.has(term))));
}

export function filterArticles(
  articles: Article[],
  filters: SearchFilters,
): Article[] {
  return articles.filter((article) => {
    const year = articleYear(article);
    if (filters.fromYear && (!year || year < filters.fromYear)) {
      return false;
    }
    if (filters.toYear && (!year || year > filters.toYear)) {
      return false;
    }
    if (
      filters.language &&
      article.language.toLowerCase() !== filters.language.toLowerCase()
    ) {
      return false;
    }
    if (
      filters.journal &&
      !article.journal.toLowerCase().includes(filters.journal.toLowerCase())
    ) {
      return false;
    }
    if (filters.publicationTypes?.length) {
      const available = article.publicationTypes.map((type) =>
        type.toLowerCase(),
      );
      const requested = filters.publicationTypes.map((type) =>
        type.toLowerCase(),
      );
      if (
        !requested.some((type) => available.some((item) => item.includes(type)))
      ) {
        return false;
      }
    }
    return true;
  });
}

export function rankArticles(
  articles: Article[],
  query: string,
): ArticleSearchResult[] {
  const terms = queryTerms(query);
  return articles
    .map((article) => {
      const haystacks = {
        title: article.title.toLowerCase(),
        abstract: article.abstractText.toLowerCase(),
        metadata: [
          article.journal,
          article.language,
          ...article.publicationTypes,
          ...article.authors,
        ]
          .join(' ')
          .toLowerCase(),
      };
      const matchedTerms = terms.filter(
        (term) =>
          haystacks.title.includes(term) ||
          haystacks.abstract.includes(term) ||
          haystacks.metadata.includes(term),
      );
      const score = terms.reduce((sum, term) => {
        let next = sum;
        if (haystacks.title.includes(term)) {
          next += 5;
        }
        if (haystacks.abstract.includes(term)) {
          next += 2;
        }
        if (haystacks.metadata.includes(term)) {
          next += 1;
        }
        return next;
      }, 0);
      const publicationYear = articleYear(article) ?? 0;
      const recencyScore = publicationYear > 0 ? publicationYear / 10_000 : 0;
      return {
        ...article,
        score: Number((score + recencyScore).toFixed(4)),
        matchedTerms,
      };
    })
    .filter((article) => terms.length === 0 || article.matchedTerms.length > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.pmid.localeCompare(left.pmid);
    });
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
