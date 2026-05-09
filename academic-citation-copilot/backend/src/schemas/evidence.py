from typing import Literal
from pydantic import BaseModel, Field, field_validator

CitationStyle = Literal["APA", "MLA"]
SourceTier = Literal["high", "medium", "low"]
SourceType = Literal["journal", "book", "website", "report", "unknown"]


class CitationMetadata(BaseModel):
    title: str
    authors: list[str] = Field(default_factory=list)
    year: str | None = None
    journal: str | None = None
    publisher: str | None = None
    url: str | None = None
    doi: str | None = None
    sourceType: SourceType = "unknown"


class EvidenceCard(BaseModel):
    id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    year: str | None = None
    sourceType: str
    sourceTier: SourceTier
    url: str | None = None
    doi: str | None = None
    snippet: str
    relevanceExplanation: str
    apaCitation: str
    mlaCitation: str


class EvidenceRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=1500)
    citationStyle: CitationStyle

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Selected text cannot be empty.")
        return normalized


class EvidenceResponse(BaseModel):
    query: str
    cards: list[EvidenceCard]
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok"]
    mockMode: bool
