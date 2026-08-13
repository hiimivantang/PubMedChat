import { createEutilsPubMedAdapter } from './eutils';
import { PubMedError } from './errors';
import { createFixturePubMedAdapter } from './fixtures';
import type { PubMedAdapter, PubMedSource } from './types';

let adapter: PubMedAdapter | null = null;

export function getPubMedAdapter(): PubMedAdapter {
  if (adapter) {
    return adapter;
  }

  const source = (
    process.env.PUBMED_SOURCE || 'fixture'
  ).toLowerCase() as PubMedSource;
  if (source === 'fixture') {
    adapter = createFixturePubMedAdapter();
    return adapter;
  }
  if (source === 'eutils') {
    adapter = createEutilsPubMedAdapter({
      email: process.env.PUBMED_EMAIL,
      tool: process.env.PUBMED_TOOL,
      apiKey: process.env.PUBMED_API_KEY,
      baseUrl: process.env.PUBMED_BASE_URL,
    });
    return adapter;
  }

  throw new PubMedError(
    'configuration_error',
    'PUBMED_SOURCE must be fixture or eutils.',
    500,
    { source },
  );
}

export function setPubMedAdapterForTest(
  nextAdapter: PubMedAdapter | null,
): void {
  adapter = nextAdapter;
}
