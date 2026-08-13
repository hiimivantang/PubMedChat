import { XMLParser } from 'fast-xml-parser';
import { PubMedError } from './errors';
import { abstractExcerpt, pubmedUrl, uniqueStrings } from './normalize';
import { filterArticles, paginate, rankArticles } from './ranking';
import type {
  Article,
  PubMedAdapter,
  SearchRequest,
  SearchResponse,
} from './types';

type EutilsOptions = {
  email?: string;
  tool?: string;
  apiKey?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
};

const DEFAULT_BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  trimValues: true,
});

export function createEutilsPubMedAdapter(
  options: EutilsOptions,
): PubMedAdapter {
  const contactEmail = options.email?.trim();
  const tool = options.tool?.trim() || 'PubMedChatPrototype';
  const baseUrl = (options.baseUrl?.trim() || DEFAULT_BASE_URL).replace(
    /\/$/,
    '',
  );
  const fetchImpl = options.fetchImpl ?? fetch;
  const cache = new Map<string, Article>();

  if (!contactEmail) {
    throw new PubMedError(
      'configuration_error',
      'PUBMED_EMAIL is required when PUBMED_SOURCE=eutils.',
      500,
    );
  }
  const email = contactEmail;

  async function request(
    path: string,
    params: Record<string, string>,
  ): Promise<Response> {
    const url = new URL(`${baseUrl}/${path}`);
    const searchParams: Record<string, string> = {
      ...params,
      tool,
      email,
    };
    if (options.apiKey) {
      searchParams.api_key = options.apiKey;
    }
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        const response = await fetchImpl(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (response.ok) {
          return response;
        }
        if (![429, 500, 502, 503, 504].includes(response.status)) {
          throw new PubMedError(
            'upstream_error',
            `PubMed E-utilities returned HTTP ${response.status}.`,
            502,
          );
        }
        lastError = new Error(`HTTP ${response.status}`);
      } catch (error) {
        lastError = error;
      }
      await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
    }

    throw new PubMedError(
      'upstream_error',
      'PubMed E-utilities did not respond successfully after retries.',
      502,
      {
        cause:
          lastError instanceof Error ? lastError.message : String(lastError),
      },
    );
  }

  async function fetchArticles(pmids: string[]): Promise<Article[]> {
    const missing = pmids.filter((pmid) => !cache.has(pmid));
    if (missing.length) {
      const response = await request('efetch.fcgi', {
        db: 'pubmed',
        id: missing.join(','),
        retmode: 'xml',
      });
      const xml = await response.text();
      for (const article of parsePubMedXml(xml)) {
        cache.set(article.pmid, article);
      }
    }
    return pmids
      .map((pmid) => cache.get(pmid))
      .filter((article): article is Article => Boolean(article));
  }

  return {
    source: 'eutils',
    async search(requestParams: SearchRequest): Promise<SearchResponse> {
      const response = await request('esearch.fcgi', {
        db: 'pubmed',
        term: requestParams.query,
        retmax: String(
          Math.min(100, requestParams.page * requestParams.pageSize + 25),
        ),
        retmode: 'json',
        sort: 'relevance',
      });
      const data = await response.json();
      const ids = data?.esearchresult?.idlist;
      if (!Array.isArray(ids)) {
        throw new PubMedError(
          'upstream_error',
          'PubMed ESearch returned an unexpected response.',
          502,
        );
      }
      const articles = await fetchArticles(ids);
      const filtered = filterArticles(articles, requestParams.filters);
      const ranked = rankArticles(filtered, requestParams.query);
      return {
        query: requestParams.query,
        page: requestParams.page,
        pageSize: requestParams.pageSize,
        total: ranked.length,
        source: 'eutils',
        results: paginate(ranked, requestParams.page, requestParams.pageSize),
        filters: requestParams.filters,
      };
    },
    async getArticle(pmid: string): Promise<Article | null> {
      const [article] = await fetchArticles([pmid]);
      return article ?? null;
    },
  };
}

export function parsePubMedXml(xml: string): Article[] {
  const parsed = parser.parse(xml);
  const articles = asArray(parsed?.PubmedArticleSet?.PubmedArticle);
  return articles
    .map(normalizePubmedArticle)
    .filter((article): article is Article => Boolean(article));
}

function normalizePubmedArticle(input: any): Article | null {
  const citation = input?.MedlineCitation;
  const article = citation?.Article;
  const pmid = text(citation?.PMID);
  const title = text(article?.ArticleTitle);
  if (!pmid || !title) {
    return null;
  }

  const abstractText = asArray(article?.Abstract?.AbstractText)
    .map((part) => {
      const label = stringValue(part?.['@_Label']);
      const value = text(part);
      return label && value ? `${label}: ${value}` : value;
    })
    .filter(Boolean)
    .join('\n\n');

  const publicationTypes = uniqueStrings(
    asArray(article?.PublicationTypeList?.PublicationType).map(text),
  );
  const articleIds = asArray(input?.PubmedData?.ArticleIdList?.ArticleId);
  const doi =
    articleIds.find((item) => item?.['@_IdType'] === 'doi')?.['#text'] ?? null;

  return {
    pmid,
    title,
    authors: normalizeAuthors(article?.AuthorList?.Author),
    journal:
      text(article?.Journal?.Title) || text(article?.Journal?.ISOAbbreviation),
    publicationDate: normalizeDate(article?.Journal?.JournalIssue?.PubDate),
    publicationTypes,
    abstractText,
    abstractExcerpt: abstractExcerpt(abstractText),
    language: text(article?.Language) || 'und',
    doi: typeof doi === 'string' ? doi : null,
    pubmedUrl: pubmedUrl(pmid),
    retracted: publicationTypes.includes('Retracted Publication'),
    corrected: publicationTypes.includes('Published Erratum'),
    source: 'pubmed-eutils',
  };
}

function normalizeAuthors(input: any): string[] {
  return uniqueStrings(
    asArray(input).map((author) => {
      const collective = text(author?.CollectiveName);
      if (collective) {
        return collective;
      }
      return [text(author?.ForeName), text(author?.LastName)]
        .filter(Boolean)
        .join(' ');
    }),
  );
}

function normalizeDate(pubDate: any): string {
  const year = text(pubDate?.Year);
  const month = monthNumber(text(pubDate?.Month));
  const dayText = text(pubDate?.Day);
  const day = dayText ? dayText.padStart(2, '0') : '01';
  if (year) {
    return `${year}-${month}-${day}`;
  }
  return text(pubDate?.MedlineDate);
}

function monthNumber(month: string): string {
  if (!month) {
    return '01';
  }
  if (/^\d+$/.test(month)) {
    return month.padStart(2, '0').slice(0, 2);
  }
  const months: Record<string, string> = {
    jan: '01',
    feb: '02',
    mar: '03',
    apr: '04',
    may: '05',
    jun: '06',
    jul: '07',
    aug: '08',
    sep: '09',
    oct: '10',
    nov: '11',
    dec: '12',
  };
  return months[month.slice(0, 3).toLowerCase()] ?? '01';
}

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

function text(value: any): string {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).trim();
  }
  if (
    typeof value['#text'] === 'string' ||
    typeof value['#text'] === 'number'
  ) {
    return String(value['#text']).trim();
  }
  return '';
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
