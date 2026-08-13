'use client';

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { SearchFilters, SearchResponse } from '@/pubmed/types';

type SearchPanelProps = {
  initialQuery?: string;
  initialResults?: SearchResponse | null;
};

const defaultFilters: SearchFilters = {
  fromYear: undefined,
  toYear: undefined,
  publicationTypes: undefined,
  journal: undefined,
  language: undefined,
};

export function SearchPanel({
  initialQuery = '',
  initialResults = null,
}: SearchPanelProps) {
  const [query, setQuery] = useState(initialQuery);
  const [fromYear, setFromYear] = useState('');
  const [toYear, setToYear] = useState('');
  const [publicationTypes, setPublicationTypes] = useState('');
  const [journal, setJournal] = useState('');
  const [language, setLanguage] = useState('');
  const [results, setResults] = useState<SearchResponse | null>(initialResults);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayResults = results?.results ?? [];
  const total = results?.total ?? 0;
  const hasSearched = Boolean(results || error || query);

  const filters = useMemo<SearchFilters>(() => {
    return {
      fromYear: fromYear ? Number(fromYear) : defaultFilters.fromYear,
      toYear: toYear ? Number(toYear) : defaultFilters.toYear,
      publicationTypes: publicationTypes
        ? publicationTypes
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean)
        : defaultFilters.publicationTypes,
      journal: journal.trim() || defaultFilters.journal,
      language: language.trim() || defaultFilters.language,
    };
  }, [fromYear, toYear, publicationTypes, journal, language]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams();
      searchParams.set('q', query);
      searchParams.set('page', '1');
      searchParams.set('page_size', '10');
      if (filters.fromYear) {
        searchParams.set('from_year', String(filters.fromYear));
      }
      if (filters.toYear) {
        searchParams.set('to_year', String(filters.toYear));
      }
      if (filters.publicationTypes?.length) {
        searchParams.set(
          'publication_types',
          filters.publicationTypes.join(','),
        );
      }
      if (filters.journal) {
        searchParams.set('journal', filters.journal);
      }
      if (filters.language) {
        searchParams.set('language', filters.language);
      }

      const response = await fetch(`/api/search?${searchParams.toString()}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error?.message || 'Search failed.');
      }
      setResults(data as SearchResponse);
    } catch (submitError) {
      setResults(null);
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'The search request could not be completed.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="search-panel panel">
      <div className="notice">
        <strong>Purpose:</strong> literature discovery over PubMed abstracts.
        Use the fixture corpus by default; switch to live E-utilities with
        environment variables when needed.
      </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <label className="stack">
          <span>Search query</span>
          <textarea
            className="search-textarea"
            placeholder="e.g. biologics for asthma review"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <div className="filter-row">
          <label className="stack">
            <span>From year</span>
            <input
              className="search-input"
              inputMode="numeric"
              placeholder="2018"
              value={fromYear}
              onChange={(event) => setFromYear(event.target.value)}
            />
          </label>
          <label className="stack">
            <span>To year</span>
            <input
              className="search-input"
              inputMode="numeric"
              placeholder="2026"
              value={toYear}
              onChange={(event) => setToYear(event.target.value)}
            />
          </label>
          <label className="stack">
            <span>Publication types</span>
            <input
              className="search-input"
              placeholder="Review, Randomized Controlled Trial"
              value={publicationTypes}
              onChange={(event) => setPublicationTypes(event.target.value)}
            />
          </label>
          <label className="stack">
            <span>Journal</span>
            <input
              className="search-input"
              placeholder="Journal of Clinical Medicine"
              value={journal}
              onChange={(event) => setJournal(event.target.value)}
            />
          </label>
          <label className="stack">
            <span>Language</span>
            <input
              className="search-input"
              placeholder="eng"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            />
          </label>
        </div>

        <button className="search-button" disabled={loading} type="submit">
          {loading ? 'Searching PubMed…' : 'Search'}
        </button>
      </form>

      {error ? (
        <div className="error-state">
          <strong>Upstream error:</strong> {error}
        </div>
      ) : null}

      {!hasSearched ? (
        <div className="empty-state">
          Enter a query to search the current corpus. Results will show PMID,
          title, authors, journal, publication date, publication type, abstract
          excerpt, and PubMed link.
        </div>
      ) : null}

      {results ? (
        <div className="stack">
          <div className="result-header">
            <div>
              <h2>Ranked results</h2>
              <p className="helper">
                {total} records matched on the selected corpus
              </p>
            </div>
            <div className="badge-row">
              <span className="badge">Source: {results.source}</span>
              {filters.fromYear ? (
                <span className="pill">from {filters.fromYear}</span>
              ) : null}
              {filters.toYear ? (
                <span className="pill">to {filters.toYear}</span>
              ) : null}
            </div>
          </div>

          {displayResults.length === 0 ? (
            <div className="empty-state">
              No results matched. Try a broader query, fewer filters, or a
              different synonym.
            </div>
          ) : (
            <div className="results">
              {displayResults.map((article) => (
                <article className="card" key={article.pmid}>
                  <div className="card-title">
                    <div>
                      <h3>{article.title}</h3>
                      <p className="meta">PMID {article.pmid}</p>
                    </div>
                    <span className="stat">
                      Score {article.score.toFixed(2)}
                    </span>
                  </div>
                  <div className="badge-row">
                    {article.publicationTypes.slice(0, 3).map((type) => (
                      <span className="badge" key={type}>
                        {type}
                      </span>
                    ))}
                    {article.retracted ? (
                      <span className="badge">Retracted</span>
                    ) : null}
                    {article.corrected ? (
                      <span className="badge">Corrected</span>
                    ) : null}
                  </div>
                  <div className="meta-row">
                    <span className="pill">
                      {article.authors.slice(0, 3).join(', ')}
                      {article.authors.length > 3 ? ' et al.' : ''}
                    </span>
                    <span className="pill">{article.journal}</span>
                    <span className="pill">{article.publicationDate}</span>
                    {article.doi ? (
                      <span className="pill">DOI {article.doi}</span>
                    ) : null}
                  </div>
                  <p className="result-snippet">{article.abstractExcerpt}</p>
                  <div className="meta-row">
                    <a
                      className="link-button"
                      href={article.pubmedUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      View on PubMed
                    </a>
                    <a
                      className="link-button"
                      href={`/articles/${article.pmid}`}
                    >
                      Open detail view
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
