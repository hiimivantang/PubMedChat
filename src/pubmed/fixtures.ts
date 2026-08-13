import fixture from '@/fixtures/pubmed.fixture.json';
import { filterArticles, paginate, rankArticles } from './ranking';
import type {
  Article,
  PubMedAdapter,
  SearchRequest,
  SearchResponse,
} from './types';

const fixtureArticles = fixture.articles as Article[];

export function createFixturePubMedAdapter(
  articles: Article[] = fixtureArticles,
): PubMedAdapter {
  return {
    source: 'fixture',
    async search(request: SearchRequest): Promise<SearchResponse> {
      const filtered = filterArticles(articles, request.filters);
      const ranked = rankArticles(filtered, request.query);
      return {
        query: request.query,
        page: request.page,
        pageSize: request.pageSize,
        total: ranked.length,
        source: 'fixture',
        results: paginate(ranked, request.page, request.pageSize),
        filters: request.filters,
      };
    },
    async getArticle(pmid: string): Promise<Article | null> {
      return articles.find((article) => article.pmid === pmid) ?? null;
    },
  };
}
