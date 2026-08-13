export type PubMedSource = 'fixture' | 'eutils';

export type Article = {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  publicationDate: string;
  publicationTypes: string[];
  abstractText: string;
  abstractExcerpt: string;
  language: string;
  doi: string | null;
  pubmedUrl: string;
  retracted: boolean;
  corrected: boolean;
  source: string;
};

export type ArticleSearchResult = Article & {
  score: number;
  matchedTerms: string[];
};

export type SearchFilters = {
  fromYear?: number;
  toYear?: number;
  publicationTypes?: string[];
  journal?: string;
  language?: string;
};

export type SearchRequest = {
  query: string;
  page: number;
  pageSize: number;
  filters: SearchFilters;
};

export type SearchResponse = {
  query: string;
  page: number;
  pageSize: number;
  total: number;
  source: PubMedSource;
  results: ArticleSearchResult[];
  filters: SearchFilters;
};

export type ApiErrorCode =
  'bad_request' | 'not_found' | 'upstream_error' | 'configuration_error';

export type ApiErrorResponse = {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type PubMedAdapter = {
  readonly source: PubMedSource;
  search(request: SearchRequest): Promise<SearchResponse>;
  getArticle(pmid: string): Promise<Article | null>;
};
