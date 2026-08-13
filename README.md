# PubMedChat

PubMedChat is a prototype PubMed search and article-detail app. The first slice runs in fixture mode by default so you can develop and test without network access.

## Requirements

- Node.js 22+
- npm 10+

## Install

```bash
npm install
```

## Environment

Copy `.env.example` to `.env.local` if you want to use live PubMed E-utilities.

Fixture mode is the default:

```bash
PUBMED_SOURCE=fixture
```

Live mode uses E-utilities and requires a contact email:

```bash
PUBMED_SOURCE=eutils
PUBMED_EMAIL=you@example.com
PUBMED_TOOL=PubMedChat
PUBMED_BASE_URL=https://eutils.ncbi.nlm.nih.gov/entrez/eutils
PUBMED_API_KEY=
```

## Development

Start the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Search flow

- Search uses the backend at `GET /api/search`.
- Article detail uses `GET /api/articles/:pmid`.
- `GET /api/health` returns a simple readiness response.

## Tests and checks

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Notes

- The fixture corpus contains normalized PubMed records captured from live E-utilities and stored locally for offline use.
- The app is for literature discovery only, not medical advice.
