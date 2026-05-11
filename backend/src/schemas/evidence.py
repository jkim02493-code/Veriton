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
    language: str | None = None
    sourceType: SourceType = "unknown"


class EvidenceCard(BaseModel):
    id: str
    title: str
    authors: list[str] = Field(default_factory=list)
    year: str | None = None
    ageBucket: AgeBucket | None = None
    language: str | None = None
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
    searchLanguage: str = "en"
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

    @field_validator("searchLanguage")
    @classmethod
    def normalize_search_language(cls, value: str) -> str:
        normalized = (value or "en").strip().lower()
        return normalized if normalized in {"en", "ja", "es", "zh"} else "en"


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1, max_length=3000)
    seen_urls: list[str] = Field(default_factory=list)
    searchLanguage: str = "en"
    citationStyle: CitationStyle = "APA"
    recencyPreference: RecencyPreference = "balanced"
    demoMode: bool = False

    @field_validator("query")
    @classmethod
    def query_must_not_be_blank(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Search query cannot be empty.")
        if any(pattern.search(normalized) for pattern in INVALID_SELECTION_PATTERNS):
            raise ValueError("Search query appears to be a local path or shell command, not Google Docs prose.")
        return normalized

    @field_validator("searchLanguage")
    @classmethod
    def normalize_search_language(cls, value: str) -> str:
        normalized = (value or "en").strip().lower()
        return normalized if normalized in {"en", "ja", "es", "zh"} else "en"


class UsageState(BaseModel):
    plan: Literal["free", "pro"]
    lifetimeSearches: int
    searchesToday: int
    remainingSearches: int
    limit: int
    resetsAt: str | None = None


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


class SearchResponse(EvidenceResponse):
    usage: UsageState


class HealthResponse(BaseModel):
    status: Literal["ok"]
    mockMode: bool


class StarSourceRequest(BaseModel):
    source: EvidenceCard


class StarredSource(BaseModel):
    id: str
    source_title: str
    authors: str | None = None
    url: str | None = None
    citation_apa: str | None = None
    citation_mla: str | None = None
    year: str | None = None
    starred_at: str


class SearchHistoryEntry(BaseModel):
    id: str
    query: str
    sources_returned: list[EvidenceCard] = Field(default_factory=list)
    searched_at: str


class CurrentUserResponse(BaseModel):
    id: str
    email: str | None = None
    usage: UsageState
