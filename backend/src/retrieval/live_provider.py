import json
import logging
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor, TimeoutError as ProviderTimeoutError
from dataclasses import dataclass
from typing import Any, Callable
from urllib.error import HTTPError, URLError

from src.retrieval.base import ProviderEvidence
from src.services.query_understanding import QueryFocus, is_clear_mismatch, is_foundational_source, passes_recency_guard, relevance_score, source_age_bucket, topical_match_strength

logger = logging.getLogger(__name__)
PROVIDER_TIMEOUT_SECONDS = 8.0


@dataclass
class ProviderAttempt:
    name: str
    endpoint: str
    raw_count: int = 0
    relevant_count: int = 0
    failed: bool = False


class LiveAcademicRetrievalProvider:
    def __init__(self, timeout_seconds: float = 5.0) -> None:
        self.timeout_seconds = timeout_seconds
        self.last_attempts: list[ProviderAttempt] = []
        self.last_all_providers_failed = False
        self._query_suffix = ""
        self._search_language = "en"

    def retrieve(self, focus: QueryFocus, recency_preference: str = "balanced", search_language: str = "en", query_suffix: str = "") -> list[ProviderEvidence]:
        self.last_attempts = []
        self.last_all_providers_failed = False
        previous_query_suffix = self._query_suffix
        previous_search_language = self._search_language
        self._query_suffix = query_suffix
        self._search_language = search_language
        try:
            for provider_name, provider in (
                ("OpenAlex", self._openalex),
                ("Crossref", self._crossref),
                ("Semantic Scholar", self._semantic_scholar),
                ("arXiv", self._arxiv),
            ):
                endpoint = ""
                try:
                    endpoint, cards = self._call_provider_with_timeout(provider, focus)
                except ProviderTimeoutError as exc:
                    endpoint = f"{provider_name} timed out after {PROVIDER_TIMEOUT_SECONDS:.0f}s"
                    self._log_provider_failure(provider_name, endpoint, exc)
                    self.last_attempts.append(ProviderAttempt(name=provider_name, endpoint=endpoint, failed=True))
                    continue
                except Exception as exc:
                    self._log_provider_failure(provider_name, endpoint or "not built", exc)
                    self.last_attempts.append(ProviderAttempt(name=provider_name, endpoint=endpoint or "not built", failed=True))
                    continue

                relevant = self._rank_and_filter(focus, cards, recency_preference)
                self.last_attempts.append(ProviderAttempt(name=provider_name, endpoint=endpoint, raw_count=len(cards), relevant_count=len(relevant)))
                if relevant:
                    return relevant

            self.last_all_providers_failed = all(attempt.failed or attempt.raw_count == 0 for attempt in self.last_attempts)
            return []
        finally:
            self._query_suffix = previous_query_suffix
            self._search_language = previous_search_language

    def _call_provider_with_timeout(self, provider: Callable[[QueryFocus], tuple[str, list[ProviderEvidence]]], focus: QueryFocus) -> tuple[str, list[ProviderEvidence]]:
        executor = ThreadPoolExecutor(max_workers=1)
        future = executor.submit(provider, focus)
        try:
            return future.result(timeout=PROVIDER_TIMEOUT_SECONDS)
        except ProviderTimeoutError:
            future.cancel()
            raise
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    def _get_json(self, url: str) -> dict[str, Any]:
        request = urllib.request.Request(url, headers={"User-Agent": "academic-citation-copilot/0.1 (mailto:demo@example.com)"})
        with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
            return json.loads(response.read().decode("utf-8"))

    def _get_text(self, url: str) -> str:
        request = urllib.request.Request(url, headers={"User-Agent": "academic-citation-copilot/0.1 (mailto:demo@example.com)"})
        with urllib.request.urlopen(request, timeout=self.timeout_seconds) as response:
            return response.read().decode("utf-8")

    def _provider_search_query(self, focus: QueryFocus) -> str:
        return f"{focus.search_query} {self._query_suffix}".strip()

    def _openalex(self, focus: QueryFocus) -> tuple[str, list[ProviderEvidence]]:
        params = {"search": self._provider_search_query(focus), "per-page": "8"}
        if self._search_language in {"ja", "es", "zh"}:
            params["filter"] = f"language:{self._search_language}"
        query = urllib.parse.urlencode(params)
        endpoint = f"https://api.openalex.org/works?{query}"
        data = self._get_json(endpoint)
        cards: list[ProviderEvidence] = []
        for item in data.get("results", []):
            title = item.get("display_name") or ""
            snippet = _abstract_from_openalex(item.get("abstract_inverted_index")) or title
            authors = [
                authorship.get("author", {}).get("display_name")
                for authorship in item.get("authorships", [])
                if authorship.get("author", {}).get("display_name")
            ][:4]
            cards.append(
                ProviderEvidence(
                    id=item.get("id") or title,
                    title=title,
                    authors=authors or ["Unknown author"],
                    year=str(item.get("publication_year") or ""),
                    journal=(item.get("primary_location") or {}).get("source", {}).get("display_name"),
                    sourceType="journal" if item.get("type") == "article" else "unknown",
                    sourceTier="high",
                    url=item.get("doi") or item.get("id"),
                    doi=item.get("doi"),
                    language=item.get("language"),
                    snippet=snippet,
                    relevanceExplanation=_why_relevant(focus, title, snippet),
                )
            )
        return endpoint, cards

    def _crossref(self, focus: QueryFocus) -> tuple[str, list[ProviderEvidence]]:
        query = urllib.parse.urlencode({"query.bibliographic": self._provider_search_query(focus), "rows": "8"})
        endpoint = f"https://api.crossref.org/works?{query}"
        data = self._get_json(endpoint)
        cards: list[ProviderEvidence] = []
        for item in data.get("message", {}).get("items", []):
            title = " ".join(item.get("title") or []) if isinstance(item.get("title"), list) else item.get("title", "")
            snippet = " ".join(item.get("abstract") or item.get("subtitle") or []) if isinstance(item.get("abstract") or item.get("subtitle"), list) else (item.get("abstract") or title)
            authors = [
                " ".join(part for part in [author.get("given"), author.get("family")] if part)
                for author in item.get("author", [])
            ][:4]
            year_parts = item.get("published-print", item.get("published-online", {})).get("date-parts", [[None]])
            year = str(year_parts[0][0]) if year_parts and year_parts[0] and year_parts[0][0] else ""
            doi = item.get("DOI")
            cards.append(
                ProviderEvidence(
                    id=f"crossref:{doi or title}",
                    title=title,
                    authors=authors or ["Unknown author"],
                    year=year,
                    journal=" ".join(item.get("container-title") or []) if isinstance(item.get("container-title"), list) else item.get("container-title"),
                    sourceType="journal" if item.get("type") == "journal-article" else "unknown",
                    sourceTier="high" if item.get("type") == "journal-article" else "medium",
                    url=item.get("URL"),
                    doi=f"https://doi.org/{doi}" if doi else None,
                    language=item.get("language"),
                    snippet=_strip_html(snippet),
                    relevanceExplanation=_why_relevant(focus, title, snippet),
                )
            )
        return endpoint, cards

    def _semantic_scholar(self, focus: QueryFocus) -> tuple[str, list[ProviderEvidence]]:
        query = urllib.parse.urlencode({"query": self._provider_search_query(focus), "limit": "8", "fields": "title,authors,year,venue,abstract,url,externalIds,publicationTypes"})
        endpoint = f"https://api.semanticscholar.org/graph/v1/paper/search?{query}"
        data = self._get_json(endpoint)
        cards: list[ProviderEvidence] = []
        for item in data.get("data", []):
            title = item.get("title") or ""
            snippet = item.get("abstract") or title
            doi = (item.get("externalIds") or {}).get("DOI")
            arxiv = (item.get("externalIds") or {}).get("ArXiv")
            source_type = "journal" if "JournalArticle" in (item.get("publicationTypes") or []) else ("unknown" if not arxiv else "website")
            cards.append(
                ProviderEvidence(
                    id=f"s2:{item.get('paperId') or title}",
                    title=title,
                    authors=[author.get("name") for author in item.get("authors", []) if author.get("name")][:4] or ["Unknown author"],
                    year=str(item.get("year") or ""),
                    journal=item.get("venue"),
                    sourceType=source_type,
                    sourceTier="high" if source_type == "journal" else "medium",
                    url=item.get("url") or (f"https://arxiv.org/abs/{arxiv}" if arxiv else None),
                    doi=f"https://doi.org/{doi}" if doi else None,
                    snippet=snippet,
                    relevanceExplanation=_why_relevant(focus, title, snippet),
                )
            )
        return endpoint, cards

    def _arxiv(self, focus: QueryFocus) -> tuple[str, list[ProviderEvidence]]:
        query = urllib.parse.urlencode({"search_query": f"all:{self._provider_search_query(focus)}", "start": "0", "max_results": "8"})
        endpoint = f"https://export.arxiv.org/api/query?{query}"
        data = self._get_text(endpoint)
        root = ET.fromstring(data)
        namespace = {"atom": "http://www.w3.org/2005/Atom"}
        cards: list[ProviderEvidence] = []
        for entry in root.findall("atom:entry", namespace):
            title = _strip_html(entry.findtext("atom:title", default="", namespaces=namespace))
            snippet = _strip_html(entry.findtext("atom:summary", default=title, namespaces=namespace))
            published = entry.findtext("atom:published", default="", namespaces=namespace)
            year = published[:4] if len(published) >= 4 else ""
            authors = [
                author.findtext("atom:name", default="", namespaces=namespace)
                for author in entry.findall("atom:author", namespace)
            ]
            arxiv_id = entry.findtext("atom:id", default="", namespaces=namespace)
            cards.append(
                ProviderEvidence(
                    id=f"arxiv:{arxiv_id or title}",
                    title=title,
                    authors=[author for author in authors if author][:4] or ["Unknown author"],
                    year=year,
                    journal="arXiv",
                    sourceType="website",
                    sourceTier="medium",
                    url=arxiv_id or None,
                    doi=None,
                    snippet=snippet,
                    relevanceExplanation=_why_relevant(focus, title, snippet),
                )
            )
        return endpoint, cards

    def _rank_and_filter(self, focus: QueryFocus, cards: list[ProviderEvidence], recency_preference: str = "balanced") -> list[ProviderEvidence]:
        unique: dict[str, tuple[ProviderEvidence, float]] = {}
        for card in cards:
            if not card.title or is_clear_mismatch(focus, card.title, card.snippet):
                continue
            if not passes_recency_guard(focus, card.year, card.title, card.snippet, recency_preference):
                continue
            score = relevance_score(focus, card.title, card.snippet, card.sourceType, card.year, recency_preference)
            age_bucket = source_age_bucket(card.year)
            if age_bucket == "Foundational" and not is_foundational_source(focus, card.title, card.snippet) and topical_match_strength(focus, card.title, card.snippet) < 7:
                continue
            if score < (4.5 if focus.protected_concept else 2.5):
                continue
            key = (card.doi or card.title).lower()
            previous = unique.get(key)
            if not previous or score > previous[1]:
                unique[key] = (card, score)
        ranked = [card for card, _score in sorted(unique.values(), key=lambda item: item[1], reverse=True)]
        if recency_preference == "balanced":
            return _compose_balanced_results(focus, ranked)[:5]
        return ranked[:5]

    def _log_provider_failure(self, provider_name: str, endpoint: str, exc: Exception) -> None:
        status: int | str | None = None
        response_body = ""
        if isinstance(exc, HTTPError):
            status = exc.code
            try:
                response_body = exc.read().decode("utf-8")[:1000]
            except Exception:
                response_body = ""
        elif isinstance(exc, URLError):
            status = exc.reason.__class__.__name__
        else:
            status = exc.__class__.__name__
        logger.warning(
            "live provider failed",
            extra={
                "provider": provider_name,
                "endpoint": endpoint,
                "status_or_exception": status,
                "response_body": response_body,
            },
        )


def _abstract_from_openalex(index: dict[str, list[int]] | None) -> str:
    if not index:
        return ""
    words: list[tuple[int, str]] = []
    for word, positions in index.items():
        words.extend((position, word) for position in positions)
    return " ".join(word for _, word in sorted(words))[:700]


def _strip_html(text: str) -> str:
    return " ".join(text.replace("<jats:p>", " ").replace("</jats:p>", " ").split())


def _compose_balanced_results(focus: QueryFocus, ranked: list[ProviderEvidence]) -> list[ProviderEvidence]:
    recent = [card for card in ranked if source_age_bucket(card.year) == "Recent"]
    mid = [card for card in ranked if source_age_bucket(card.year) == "Mid"]
    older = [
        card
        for card in ranked
        if source_age_bucket(card.year) == "Foundational"
        and is_foundational_source(focus, card.title, card.snippet)
        and topical_match_strength(focus, card.title, card.snippet) >= 6
    ]
    unknown = [card for card in ranked if source_age_bucket(card.year) is None]

    chosen: list[ProviderEvidence] = []

    if focus.recency_topic == "strong":
        chosen.extend(recent[:3])
    else:
        chosen.extend(recent[:2])
    if mid:
        chosen.append(mid[0])
    if older and focus.recency_topic != "strong":
        chosen.append(older[0])

    for card in ranked:
        if card not in chosen and (source_age_bucket(card.year) != "Foundational" or card in older):
            chosen.append(card)
        if len(chosen) >= 5:
            break

    if len(chosen) < 5:
        chosen.extend(card for card in unknown if card not in chosen)
    return chosen


def _why_relevant(focus: QueryFocus, title: str, snippet: str) -> str:
    supported = focus.original_text.strip()
    if len(supported) > 120:
        supported = f"{supported[:117]}..."
    return f"Why this fits: it matches the search focus '{focus.display_topic}' and supports the selected text: \"{supported}\"."
