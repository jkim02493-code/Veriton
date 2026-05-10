import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
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
    if result.ambiguous:
        warnings.append("Your selection is ambiguous. What is the main claim you want to support?")
    elif result.live_unavailable:
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
