from fastapi import APIRouter, Depends, HTTPException, Request, status
from src.config.settings import Settings, get_settings
from src.schemas.evidence import EvidenceRequest, EvidenceResponse, HealthResponse
from src.services.evidence_service import retrieve_evidence

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health(settings: Settings = Depends(get_settings)) -> HealthResponse:
    return HealthResponse(status="ok", mockMode=settings.mock_mode)


@router.post("/evidence", response_model=EvidenceResponse)
def evidence(request: EvidenceRequest, settings: Settings = Depends(get_settings)) -> EvidenceResponse:
    try:
        cards = retrieve_evidence(request.text, settings)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "retrieval_failed", "message": "Evidence retrieval failed. Please try again."},
        ) from exc

    warnings = [] if cards else ["No strong evidence found."]
    return EvidenceResponse(query=request.text, cards=cards, warnings=warnings)
