from src.retrieval.base import ProviderEvidence

_TIER_SCORE = {"high": 0, "medium": 1, "low": 2}


def rank_evidence(cards: list[ProviderEvidence]) -> list[ProviderEvidence]:
    def key(card: ProviderEvidence) -> tuple[int, int]:
        tier_score = _TIER_SCORE.get(card.sourceTier, 3)
        try:
            year_score = -int(card.year or 0)
        except ValueError:
            year_score = 0
        return (tier_score, year_score)

    return sorted(cards, key=key)
