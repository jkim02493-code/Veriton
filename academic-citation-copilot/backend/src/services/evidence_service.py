from src.config.settings import Settings
from src.retrieval.base import RetrievalProvider
from src.retrieval.mock_provider import MockRetrievalProvider
from src.schemas.evidence import EvidenceCard
from src.services.normalizer import normalize_provider_cards
from src.services.ranking import rank_evidence


def get_retrieval_provider(settings: Settings) -> RetrievalProvider:
    if settings.mock_mode:
        return MockRetrievalProvider()
    return MockRetrievalProvider()


def retrieve_evidence(query: str, settings: Settings) -> list[EvidenceCard]:
    provider = get_retrieval_provider(settings)
    provider_cards = provider.retrieve(query)
    ranked_cards = rank_evidence(provider_cards)
    return normalize_provider_cards(ranked_cards[:3])
