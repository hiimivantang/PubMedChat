import { describe, expect, it, beforeEach } from 'vitest';
import { GET as healthGET } from '@/app/api/health/route';
import { GET as searchGET } from '@/app/api/search/route';
import { GET as articleGET } from '@/app/api/articles/[pmid]/route';
import { createFixturePubMedAdapter } from '@/pubmed/fixtures';
import { setPubMedAdapterForTest } from '@/pubmed';

beforeEach(() => {
  setPubMedAdapterForTest(createFixturePubMedAdapter());
});

describe('API routes', () => {
  it('returns health status', async () => {
    const response = await healthGET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: 'ok' });
  });

  it('returns search results', async () => {
    const response = await searchGET(
      new Request('http://localhost/api/search?q=asthma'),
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      results: Array<{ pmid: string }>;
    };
    expect(body.results.length).toBeGreaterThan(0);
    expect(body.results[0].pmid).toBeTruthy();
  });

  it('returns article details', async () => {
    const adapter = createFixturePubMedAdapter();
    const article = await adapter.search({
      query: 'asthma',
      page: 1,
      pageSize: 1,
      filters: {},
    });
    const pmid = article.results[0].pmid;
    const response = await articleGET(
      new Request('http://localhost/api/articles/' + pmid),
      {
        params: Promise.resolve({ pmid }),
      },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      article: {
        pmid,
      },
    });
  });

  it('returns not found for missing articles', async () => {
    const response = await articleGET(
      new Request('http://localhost/api/articles/00000000'),
      {
        params: Promise.resolve({ pmid: '00000000' }),
      },
    );

    expect(response.status).toBe(404);
  });
});
