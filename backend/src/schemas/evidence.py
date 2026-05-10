from typing import Literal
import re
from pydantic import BaseModel, Field, field_validator

CitationStyle = Literal["APA", "MLA"]
SourceTier = Literal["high", "medium", "low"]
SourceType = Literal["journal", "book", "website", "report", "unknown"]
RecencyPreference = Literal["recent", "balanced", "foundational"]
AgeBucket = Literal["Recent", "Mid", "Foundational", "Older"]
INVALID_SELECTION_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\.venv",
        r"scripts[\\/]+activate\.ps1",
        r"npm\s+run",
        r"python\s+-m",
        r"c:[\\/]+users[\\/]+",
        r"\bpowershell\b",
        r"\bset-executionpolicy\b",
        r"\bactivate\.ps1\b",
        r"^[a-z]:[\\/]",
        r"[\\/](node_modules|\.git|\.venv)[\\/]",
    ]
]


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
    ageBucket: AgeBucket | None = None
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
    recencyPreference: RecencyPreference = "balanced"
    demoMode: bool = False

    @field_validator("text")
    @classmethod
    def text_must_not_be_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Selected text cannot be empty.")
        if any(pattern.search(normalized) for pattern in INVALID_SELECTION_PATTERNS):
            raise ValueError("Selected text appears to be a local path or shell command, not Google Docs prose.")
        return normalized


class EvidenceResponse(BaseModel):
    query: str
    searchFocus: str | None = None
    cards: list[EvidenceCard]
    evidence: list[EvidenceCard] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)
    error: str | None = None
    message: str | None = None
    retry: bool = False
    demoMode: bool = False


class HealthResponse(BaseModel):
    status: Literal["ok"]
    mockMode: bool
