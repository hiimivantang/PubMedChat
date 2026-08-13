import { PubMedError } from './errors';
import type { SearchRequest } from './types';

const MAX_QUERY_LENGTH = 300;
const MAX_PAGE_SIZE = 25;

export function parseSearchParams(params: URLSearchParams): SearchRequest {
  const query = params.get('q')?.trim() ?? '';
  if (!query) {
    throw new PubMedError(
      'bad_request',
      'Search query parameter q is required.',
      400,
    );
  }
  if (query.length > MAX_QUERY_LENGTH) {
    throw new PubMedError(
      'bad_request',
      `Search query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
      400,
    );
  }

  return {
    query,
    page: positiveInteger(params.get('page'), 1, 1, 10_000, 'page'),
    pageSize: positiveInteger(
      params.get('page_size'),
      10,
      1,
      MAX_PAGE_SIZE,
      'page_size',
    ),
    filters: {
      fromYear: optionalYear(params.get('from_year'), 'from_year'),
      toYear: optionalYear(params.get('to_year'), 'to_year'),
      publicationTypes: listParam(params.get('publication_types')),
      journal: optionalText(params.get('journal')),
      language: optionalText(params.get('language')),
    },
  };
}

function positiveInteger(
  value: string | null,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new PubMedError(
      'bad_request',
      `${name} must be an integer from ${min} to ${max}.`,
      400,
    );
  }
  return parsed;
}

function optionalYear(value: string | null, name: string): number | undefined {
  if (!value) {
    return undefined;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1800 || parsed > 2100) {
    throw new PubMedError(
      'bad_request',
      `${name} must be a four-digit year.`,
      400,
    );
  }
  return parsed;
}

function optionalText(value: string | null): string | undefined {
  const text = value?.trim();
  return text || undefined;
}

function listParam(value: string | null): string[] | undefined {
  const values = value
    ?.split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return values?.length ? values : undefined;
}
