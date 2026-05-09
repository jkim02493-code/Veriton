# Academic Citation Copilot

A production-quality MVP for a Chrome-extension-based academic evidence and citation copilot for Google Docs. A student highlights a claim, opens the sidebar, chooses APA or MLA, finds three credible evidence cards, then copies or attempts to insert a citation into the document.

## Architecture overview

- **Chrome Extension MV3 frontend:** React, TypeScript, Vite, and Tailwind run as a Google Docs content script.
- **Shadow DOM sidebar:** The content script mounts React inside a Shadow DOM root to avoid Google Docs CSS collisions.
- **FastAPI backend:** A local API at `http://localhost:8000` exposes `/health` and `/evidence`.
- **Retrieval pipeline:** The route calls a retrieval service, provider interface, mock provider, ranking utility, and normalizer before returning canonical evidence cards.
- **No LLM APIs:** MVP v1 uses deterministic citation formatting and mock retrieval only.

## Folder structure

```text
academic-citation-copilot/
  extension/      Chrome extension frontend
  backend/        FastAPI backend and pytest tests
  shared/types/   TypeScript contracts shared by frontend code
```

## How to run the backend

```bash
cd academic-citation-copilot/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn src.main:app --reload --port 8000
```

## How to run the extension

```bash
cd academic-citation-copilot/extension
npm install
npm run build
```

The extension dependencies are exact-pinned in `package.json` for reproducible local installs instead of relying on moving `latest` ranges.

For development rebuilds, run:

```bash
npm run dev
```

## Load the unpacked extension in Chrome

1. Build the extension with `npm run build`.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select `academic-citation-copilot/extension/dist`.
6. Open a Google Docs document at `https://docs.google.com/document/...` and highlight a claim.


## Package registry troubleshooting

If dependency installation fails with `403 Forbidden`, first verify whether the shell can reach PyPI and npm:

```bash
cd academic-citation-copilot
python scripts/check_install_network.py
```

This script uses only the Python standard library. If it reports that PyPI or npm is unreachable, the failure is caused by the local network/proxy environment rather than this repository. Allow outbound access to `https://pypi.org`, `https://files.pythonhosted.org`, and `https://registry.npmjs.org`, or configure an approved internal mirror before rerunning the install commands.

## Environment variables

Backend variables live in `backend/.env` and are documented in `backend/.env.example`.

| Variable | Purpose |
| --- | --- |
| `PORT` | Local API port, default `8000`. |
| `MOCK_MODE` | Uses the mock retrieval provider when `true`. |
| `BACKEND_CORS_ORIGINS` | Comma-separated local extension/dev origins. |
| `SEMANTIC_SCHOLAR_API_KEY` | Future provider placeholder. |
| `OPENALEX_API_KEY` | Future provider placeholder. |
| `CROSSREF_API_KEY` | Future provider placeholder. |

Extension API configuration uses `VITE_API_BASE_URL`; if omitted, it defaults to `http://localhost:8000`.

## Local backend URL and CORS notes

The extension calls `http://localhost:8000/evidence` directly from the sidebar React app. FastAPI CORS allows configured local origins and Chrome extension origins for local development.

## API endpoints

### `GET /health`

Returns:

```json
{ "status": "ok", "mockMode": true }
```

### `POST /evidence`

Request:

```json
{ "text": "Climate change affects marine biodiversity", "citationStyle": "APA" }
```

Response:

```json
{ "query": "Climate change affects marine biodiversity", "cards": [], "warnings": [] }
```

Text is trimmed, cannot be blank, and is limited to 1500 characters.

## Mock retrieval explanation

The MVP intentionally works without external APIs or LLM keys. The mock provider returns three realistic academic evidence cards with source metadata, trust tiers, snippets, relevance explanations, and deterministic APA/MLA citations.

## Future retrieval integrations

Add providers such as `querySemanticScholar()`, `queryOpenAlex()`, or `queryCrossref()` behind `RetrievalProvider` in `backend/src/retrieval/base.py`. Provider-specific output should be converted by `backend/src/services/normalizer.py`, so `/evidence` and frontend contracts do not change.

## Privacy notes

- The extension reads only the active selected text via `window.getSelection()`.
- The extension does not scrape or send the whole Google Docs document.
- The backend does not store document contents.
- Secrets must stay in backend environment variables and never be embedded in extension code.

## Known MVP limitations

- Google Docs selection and insertion are lightweight browser API implementations and may fail in complex Docs states.
- If insertion fails, the citation is copied to the clipboard and the user is prompted to paste manually.
- Retrieval is mocked and does not yet search live academic indexes.
- Citation formatting is intentionally basic and deterministic, not a complete style-guide engine.

## How to run tests

```bash
cd academic-citation-copilot/backend
pytest
```

The backend also includes `pyproject.toml` pytest configuration so imports resolve consistently from the `backend` directory.

## What currently works

- Shadow DOM React sidebar injection on Google Docs.
- Selected-text preview and APA/MLA selector.
- `/health` and `/evidence` backend endpoints.
- 10-second frontend request timeout with friendly errors.
- Mock evidence retrieval, trust-tier ranking, normalization, and deterministic citations.
- Copy citation and insertion fallback behavior.
- Toasts, loading skeletons, error states, and empty states.

## Recommended next retrieval integration

Start with Semantic Scholar because it is academic-paper-focused and can provide title, author, year, venue, DOI, abstract/snippet-like metadata, and URLs that map well to the canonical `EvidenceCard` schema.

## Recommended production upgrades

- Semantic Scholar integration.
- OpenAlex integration.
- Redis caching for repeated selected-text queries.
- Authentication and user-scoped limits.
- Rate limiting and abuse protection.
- Vector retrieval for semantic matching.
- Server deployment with managed environment variables.
- Telemetry/logging for backend latency, failures, and no-evidence rates.
