from dataclasses import dataclass

from src.config.settings import Settings
from src.retrieval.base import RetrievalProvider
from src.retrieval.live_provider import LiveAcademicRetrievalProvider
from src.retrieval.mock_provider import MockRetrievalProvider
from src.schemas.evidence import EvidenceCard
from src.services.normalizer import normalize_provider_cards
from src.services.query_understanding import QueryFocus, understand_query

NATIVE_SEARCH_SUFFIXES = {
    "ja": "site:jst.go.jp OR site:ndl.go.jp OR lang:ja",
    "es": "site:redalyc.org OR site:scielo.org OR lang:es",
    "zh": "site:cnki.net OR site:wanfangdata.com OR lang:zh",
}


@dataclass
class EvidenceRetrievalResult:
    cards: list[EvidenceCard]
    search_focus: str
    live_unavailable: bool = False
    demo_mode: bool = False


def get_retrieval_provider(settings: Settings) -> RetrievalProvider:
    return LiveAcademicRetrievalProvider()


def retrieve_evidence(query: str, settings: Settings, recency_preference: str = "balanced", demo_mode: bool = False, search_language: str = "en") -> EvidenceRetrievalResult:
    focus = understand_query(query)
    if demo_mode:
        demo_cards = normalize_provider_cards(MockRetrievalProvider().retrieve(focus.search_query)[:3])
        return EvidenceRetrievalResult(cards=demo_cards, search_focus=focus.display_topic, demo_mode=True)
    provider = get_retrieval_provider(settings)
    normalized_language = search_language if search_language in NATIVE_SEARCH_SUFFIXES else "en"

    try:
        if normalized_language == "en":
            provider_cards = _retrieve_from_provider(provider, focus, recency_preference)
        else:
            provider_cards = _retrieve_from_provider(provider, focus, recency_preference, normalized_language, NATIVE_SEARCH_SUFFIXES[normalized_language])
    except Exception:
        return EvidenceRetrievalResult(cards=[], search_focus=focus.display_topic, live_unavailable=not settings.mock_mode)

    cards = normalize_provider_cards(provider_cards[:3])
    live_unavailable = isinstance(provider, LiveAcademicRetrievalProvider) and provider.last_all_providers_failed
    return EvidenceRetrievalResult(cards=cards, search_focus=focus.display_topic, live_unavailable=live_unavailable and not settings.mock_mode)


def _retrieve_from_provider(provider: RetrievalProvider, focus: QueryFocus, recency_preference: str, search_language: str = "en", query_suffix: str = ""):
    if isinstance(provider, LiveAcademicRetrievalProvider):
        if search_language == "en" and not query_suffix:
            return provider.retrieve(focus, recency_preference)
        return provider.retrieve(focus, recency_preference, search_language=search_language, query_suffix=query_suffix)
    return provider.retrieve(focus.search_query)
