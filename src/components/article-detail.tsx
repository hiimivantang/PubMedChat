'use client';

import { useEffect, useState } from 'react';
import type { Article } from '@/pubmed/types';

type ArticleDetailProps = {
  pmid: string;
};

type DetailState =
  | { status: 'loading' }
  | { status: 'empty' }
  | { status: 'error'; message: string }
  | { status: 'ready'; article: Article };

export function ArticleDetail({ pmid }: ArticleDetailProps) {
  const [state, setState] = useState<DetailState>({ status: 'loading' });

  useEffect(() => {
    let active = true;

    async function load() {
      setState({ status: 'loading' });
      try {
        const response = await fetch(`/api/articles/${pmid}`);
        const data = await response.json();
        if (response.status === 404) {
          if (active) {
            setState({ status: 'empty' });
          }
          return;
        }
        if (!response.ok) {
          throw new Error(data?.error?.message || 'Article lookup failed.');
        }
        if (!data.article) {
          if (active) {
            setState({ status: 'empty' });
          }
          return;
        }
        if (active) {
          setState({ status: 'ready', article: data.article as Article });
        }
      } catch (error) {
        if (active) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The article could not be loaded.',
          });
        }
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [pmid]);

  if (state.status === 'loading') {
    return <div className="loading-state">Loading article detail…</div>;
  }

  if (state.status === 'error') {
    return (
      <div className="error-state">
        <strong>Upstream error:</strong> {state.message}
      </div>
    );
  }

  if (state.status === 'empty') {
    return (
      <div className="empty-state">No article was found for PMID {pmid}.</div>
    );
  }

  const { article } = state;

  return (
    <article className="detail-grid panel">
      <div className="detail-header">
        <div>
          <p className="eyebrow">PMID {article.pmid}</p>
          <h2>{article.title}</h2>
          <p className="detail-copy">
            {article.authors.slice(0, 5).join(', ')}
            {article.authors.length > 5 ? ' et al.' : ''}
          </p>
        </div>
        <div className="badge-row">
          <span className="badge">{article.journal}</span>
          <span className="stat">{article.publicationDate}</span>
        </div>
      </div>

      <div className="detail-meta">
        <div className="pill-row">
          {article.publicationTypes.length ? (
            article.publicationTypes.map((type) => (
              <span className="pill" key={type}>
                {type}
              </span>
            ))
          ) : (
            <span className="pill">Publication type unavailable</span>
          )}
          <span className="pill">Language: {article.language}</span>
          {article.doi ? <span className="pill">DOI {article.doi}</span> : null}
          {article.retracted ? <span className="pill">Retracted</span> : null}
          {article.corrected ? <span className="pill">Corrected</span> : null}
        </div>
      </div>

      <section className="detail-section">
        <h3>Abstract excerpt</h3>
        <p>{article.abstractExcerpt}</p>
        <p className="muted small">
          Full abstract text is shown below when available.
        </p>
        {article.abstractText ? (
          <p>{article.abstractText}</p>
        ) : (
          <p>No abstract text available.</p>
        )}
      </section>

      <section className="detail-section">
        <h3>Metadata</h3>
        <div className="meta-row">
          <a
            className="link-button"
            href={article.pubmedUrl}
            rel="noreferrer"
            target="_blank"
          >
            View on PubMed
          </a>
        </div>
      </section>
    </article>
  );
}
