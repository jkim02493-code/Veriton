from src.citation.formatter import CitationInput, format_citations
from src.retrieval.base import ProviderEvidence
from src.schemas.evidence import EvidenceCard


def normalize_provider_card(card: ProviderEvidence) -> EvidenceCard:
    citations = format_citations(
        CitationInput(
            title=card.title,
            authors=card.authors,
            year=card.year,
            journal=card.journal,
            publisher=card.publisher,
            url=card.url,
            doi=card.doi,
            sourceType=card.sourceType,
        )
    )
    return EvidenceCard(
        id=card.id,
        title=card.title,
        authors=card.authors,
        year=card.year,
        sourceType=card.sourceType,
        sourceTier=card.sourceTier,
        url=card.url,
        doi=card.doi,
        snippet=card.snippet,
        relevanceExplanation=card.relevanceExplanation,
        apaCitation=citations["apa"],
        mlaCitation=citations["mla"],
    )


def normalize_provider_cards(cards: list[ProviderEvidence]) -> list[EvidenceCard]:
    return [normalize_provider_card(card) for card in cards]
