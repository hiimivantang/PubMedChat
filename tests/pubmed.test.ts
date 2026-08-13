import { describe, expect, it, beforeEach } from 'vitest';
import { getPubMedAdapter, setPubMedAdapterForTest } from '@/pubmed';
import { createFixturePubMedAdapter } from '@/pubmed/fixtures';
import { parsePubMedXml } from '@/pubmed/eutils';
import { parseSearchParams } from '@/pubmed/searchParams';
import { rankArticles } from '@/pubmed/ranking';
import fixture from '@/fixtures/pubmed.fixture.json';
import type { Article } from '@/pubmed/types';

const articles = fixture.articles as Article[];

beforeEach(() => {
  setPubMedAdapterForTest(null);
});

describe('search params', () => {
  it('parses defaults and filters', () => {
    const request = parseSearchParams(
      new URLSearchParams(
        'q=asthma&from_year=2020&to_year=2026&publication_types=Review,Trial&journal=Medicine&language=eng',
      ),
    );

    expect(request).toEqual({
      query: 'asthma',
      page: 1,
      pageSize: 10,
      filters: {
        fromYear: 2020,
        toYear: 2026,
        publicationTypes: ['Review', 'Trial'],
        journal: 'Medicine',
        language: 'eng',
      },
    });
  });
});

describe('ranking', () => {
  it('ranks title matches above abstract matches', () => {
    const ranked = rankArticles(
      [
        {
          ...articles[0],
          pmid: '1',
          title: 'Asthma therapy title match',
          abstractText: 'unrelated text',
          abstractExcerpt: 'unrelated text',
        },
        {
          ...articles[1],
          pmid: '2',
          title: 'Completely different title',
          abstractText: 'This abstract mentions asthma treatment.',
          abstractExcerpt: 'This abstract mentions asthma treatment.',
        },
      ],
      'asthma treatment',
    );

    expect(ranked[0].pmid).toBe('1');
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });

  it('drops unrelated records even when they are recent', () => {
    const ranked = rankArticles(
      [
        {
          ...articles[0],
          pmid: '1',
          title: 'Asthma therapy study',
          abstractText: 'This abstract mentions asthma.',
          abstractExcerpt: 'This abstract mentions asthma.',
          publicationDate: '2026-01-01',
        },
        {
          ...articles[1],
          pmid: '2',
          title: 'Unrelated title',
          abstractText: 'No query terms here.',
          abstractExcerpt: 'No query terms here.',
          publicationDate: '2026-01-01',
        },
      ],
      'asthma',
    );

    expect(ranked.map((article) => article.pmid)).toEqual(['1']);
  });
});

describe('fixture adapter', () => {
  it('returns ranked fixture results', async () => {
    const adapter = createFixturePubMedAdapter();
    const response = await adapter.search({
      query: 'biologics asthma',
      page: 1,
      pageSize: 5,
      filters: {},
    });

    expect(response.source).toBe('fixture');
    expect(response.total).toBeGreaterThan(0);
    expect(response.results[0]).toMatchObject({
      pmid: expect.any(String),
      title: expect.any(String),
      pubmedUrl: expect.stringContaining('pubmed.ncbi.nlm.nih.gov'),
    });
  });

  it('returns a single article by PMID', async () => {
    const adapter = createFixturePubMedAdapter();
    const article = await adapter.getArticle(articles[0].pmid);

    expect(article?.pmid).toBe(articles[0].pmid);
  });
});

describe('PubMed adapter selection', () => {
  it('defaults to the fixture adapter', () => {
    expect(getPubMedAdapter().source).toBe('fixture');
  });
});

describe('PubMed XML normalization', () => {
  it('normalizes E-utilities article XML', () => {
    const xml = `
      <PubmedArticleSet>
        <PubmedArticle>
          <MedlineCitation>
            <PMID Version="1">12345678</PMID>
            <Article>
              <ArticleTitle>Sample title</ArticleTitle>
              <Abstract>
                <AbstractText Label="Background">Background text.</AbstractText>
                <AbstractText>Conclusion text.</AbstractText>
              </Abstract>
              <AuthorList>
                <Author>
                  <LastName>Smith</LastName>
                  <ForeName>Jane</ForeName>
                </Author>
              </AuthorList>
              <Journal>
                <JournalIssue>
                  <PubDate>
                    <Year>2024</Year>
                    <Month>Feb</Month>
                    <Day>3</Day>
                  </PubDate>
                </JournalIssue>
                <Title>Sample Journal</Title>
              </Journal>
              <Language>eng</Language>
              <PublicationTypeList>
                <PublicationType>Review</PublicationType>
              </PublicationTypeList>
            </Article>
          </MedlineCitation>
          <PubmedData>
            <ArticleIdList>
              <ArticleId IdType="doi">10.1234/example</ArticleId>
            </ArticleIdList>
          </PubmedData>
        </PubmedArticle>
      </PubmedArticleSet>
    `;

    const articles = parsePubMedXml(xml);
    expect(articles).toHaveLength(1);
    expect(articles[0]).toMatchObject({
      pmid: '12345678',
      title: 'Sample title',
      authors: ['Jane Smith'],
      journal: 'Sample Journal',
      publicationDate: '2024-02-03',
      publicationTypes: ['Review'],
      abstractExcerpt: expect.stringContaining('Background text'),
      doi: '10.1234/example',
      pubmedUrl: 'https://pubmed.ncbi.nlm.nih.gov/12345678/',
    });
  });
});
