import logging

from fastapi import APIRouter, Depends, HTTPException, status
from src.config.settings import Settings, get_settings
from src.schemas.evidence import EvidenceRequest, EvidenceResponse, HealthResponse
from src.services.evidence_service import retrieve_evidence

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(status="ok", mockMode=settings.mock_mode)


@router.post("/evidence", response_model=EvidenceResponse)
def evidence(request: EvidenceRequest, settings: Settings = Depends(get_settings)) -> EvidenceResponse:
    if settings.mock_mode:
        logger.info("query text received by backend: %r", request.text)
    try:
        result = retrieve_evidence(request.text, settings, request.recencyPreference, request.demoMode)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "retrieval_failed", "message": "Evidence retrieval failed. Please try again."},
        ) from exc

    warnings = []
    if result.live_unavailable:
        warnings.append("Live academic search is temporarily unavailable.")
    elif not result.cards:
        warnings.append("No strong sources found for this selection.")
    if result.demo_mode and result.cards:
        warnings.append("Demo sources — not live results.")
    return EvidenceResponse(
        query=request.text,
        searchFocus=result.search_focus,
        cards=result.cards,
        evidence=result.cards,
        warnings=warnings,
        error="live_providers_unavailable" if result.live_unavailable else None,
        message="Live academic search is temporarily unavailable." if result.live_unavailable else None,
        retry=result.live_unavailable,
        demoMode=result.demo_mode,
    )


@router.post("/extract-topics")
async def extract_topics(request: dict):
    text = request.get("text", "")
    if not text:
        return {"topics": []}

    import re
    from collections import Counter

    stop_words = {
        "the","a","an","and","or","but","in","on","at","to","for",
        "of","with","this","that","these","those","it","its","is",
        "are","was","were","be","been","being","have","has","had",
        "do","does","did","will","would","could","should","may",
        "might","can","not","from","by","as","into","through",
        "also","such","more","most","other","some","than","then",
        "there","their","they","when","where","which","while",
        "who","how","all","any","each","been","about","after",
        "before","between","both","during","only","own","same",
        "so","very","just","over","often","even","however",
        "although","because","since","whether","within","without"
    }

    text_lower = text.lower()
    words = re.findall(r"\b[a-z]{4,}\b", text_lower)
    filtered = [word for word in words if word not in stop_words]

    bigrams = []
    for index in range(len(filtered) - 1):
        bigrams.append(f"{filtered[index]} {filtered[index + 1]}")

    trigrams = []
    for index in range(len(filtered) - 2):
        trigrams.append(f"{filtered[index]} {filtered[index + 1]} {filtered[index + 2]}")

    bigram_counts = Counter(bigrams).most_common(10)
    trigram_counts = Counter(trigrams).most_common(10)

    topics = []
    for phrase, count in trigram_counts[:2]:
        topics.append(phrase)
    for phrase, count in bigram_counts[:3]:
        if len(topics) < 4:
            topics.append(phrase)

    return {"topics": topics[:4]}
