from typing import Protocol
from src.schemas.evidence import CitationMetadata


class ProviderEvidence(CitationMetadata):
    id: str
    sourceTier: str
    snippet: str
    relevanceExplanation: str


class RetrievalProvider(Protocol):
    def retrieve(self, query: str) -> list[ProviderEvidence]:
        """Return provider-native evidence objects for a selected-text query."""
        ...
