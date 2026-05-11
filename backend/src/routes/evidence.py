import logging

from fastapi import APIRouter, Depends, Header, HTTPException, status
from src.config.settings import Settings, get_settings
from src.schemas.evidence import (
    CurrentUserResponse,
    EvidenceCard,
    EvidenceRequest,
    EvidenceResponse,
    HealthResponse,
    SearchHistoryEntry,
    SearchRequest,
    SearchResponse,
    StarSourceRequest,
    StarredSource,
)
from src.services.evidence_service import retrieve_evidence
from src.services.supabase_service import (
    SupabaseConfigError,
    UsageLimitError,
    delete_starred_source,
    enforce_and_increment_search_limit,
    ensure_user_profile,
    get_search_history,
    get_seen_source_urls,
    get_starred_sources,
    save_search_history,
    save_seen_sources,
    star_source,
    usage_from_profile,
    verify_supabase_jwt,
)

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
        result = retrieve_evidence(
            request.text,
            settings,
            request.recencyPreference,
            request.demoMode,
            request.searchLanguage,
        )
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


@router.get("/me", response_model=CurrentUserResponse)
def current_user(authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> CurrentUserResponse:
    try:
        user = verify_supabase_jwt(authorization, settings)
        profile = ensure_user_profile(user, settings)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(exc)}) from exc
    return CurrentUserResponse(id=user.id, email=user.email or profile.email, usage=usage_from_profile(profile))


@router.post("/search", response_model=SearchResponse)
def search(request: SearchRequest, authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> SearchResponse:
    try:
        user = verify_supabase_jwt(authorization, settings)
        usage = enforce_and_increment_search_limit(user, settings)
        already_seen = set(_normalize_url(url) for url in get_seen_source_urls(user, settings))
        already_seen.update(_normalize_url(url) for url in request.seen_urls)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(exc)}) from exc
    except UsageLimitError as exc:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail={"message": str(exc), "usage": exc.usage.model_dump()}) from exc

    try:
        result = retrieve_evidence(
            request.query,
            settings,
            request.recencyPreference,
            request.demoMode,
            request.searchLanguage,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"error": "retrieval_failed", "message": "Evidence retrieval failed. Please try again."},
        ) from exc

    fresh_cards = _fresh_cards(result.cards, already_seen)
    fresh_urls = [_source_url(card) for card in fresh_cards if _source_url(card)]

    save_search_history(user, settings, request.query, fresh_cards)
    save_seen_sources(user, settings, fresh_urls)

    warnings = []
    if result.live_unavailable:
        warnings.append("Live academic search is temporarily unavailable.")
    elif not fresh_cards:
        warnings.append("No fresh sources found for this search.")
    if result.demo_mode and fresh_cards:
        warnings.append("Demo sources - not live results.")

    return SearchResponse(
        query=request.query,
        searchFocus=result.search_focus,
        cards=fresh_cards,
        evidence=fresh_cards,
        warnings=warnings,
        error="live_providers_unavailable" if result.live_unavailable else None,
        message="Live academic search is temporarily unavailable." if result.live_unavailable else None,
        retry=result.live_unavailable,
        demoMode=result.demo_mode,
        usage=usage,
    )


@router.post("/star", response_model=StarredSource)
def star(request: StarSourceRequest, authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> StarredSource:
    try:
        user = verify_supabase_jwt(authorization, settings)
        ensure_user_profile(user, settings)
        row = star_source(user, settings, request.source)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(exc)}) from exc
    return StarredSource(**row)


@router.delete("/star/{source_id}", status_code=status.HTTP_204_NO_CONTENT)
def unstar(source_id: str, authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> None:
    try:
        user = verify_supabase_jwt(authorization, settings)
        delete_starred_source(user, settings, source_id)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(exc)}) from exc


@router.get("/starred", response_model=list[StarredSource])
def starred(authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> list[StarredSource]:
    try:
        user = verify_supabase_jwt(authorization, settings)
        rows = get_starred_sources(user, settings)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(exc)}) from exc
    return [StarredSource(**row) for row in rows]


@router.get("/history", response_model=list[SearchHistoryEntry])
def history(authorization: str | None = Header(default=None), settings: Settings = Depends(get_settings)) -> list[SearchHistoryEntry]:
    try:
        user = verify_supabase_jwt(authorization, settings)
        rows = get_search_history(user, settings)
    except SupabaseConfigError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail={"message": str(exc)}) from exc
    return [SearchHistoryEntry(**row) for row in rows]


def _source_url(card: EvidenceCard) -> str:
    return card.url or card.doi or ""


def _normalize_url(url: str | None) -> str:
    return (url or "").strip().rstrip("/").lower()


def _fresh_cards(cards: list[EvidenceCard], already_seen: set[str]) -> list[EvidenceCard]:
    fresh: list[EvidenceCard] = []
    for card in cards:
        normalized_url = _normalize_url(_source_url(card))
        if normalized_url and normalized_url in already_seen:
            continue
        fresh.append(card)
        if normalized_url:
            already_seen.add(normalized_url)
        if len(fresh) >= 5:
            break
    return fresh


@router.post("/extract-topics")
async def extract_topics(request: dict):
    text = request.get("text", "")
    if not text:
        return {"topics": []}
    language = request.get("language", "en")

    import re
    from collections import Counter

    english_stop_words = {
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
    japanese_stop_words = {
        "する","ある","いる","なる","れる","られる","として","について",
        "における","によって","このような","それぞれ","および","また",
        "さらに","しかし","ただし","つまり","例えば","特に"
    }
    spanish_stop_words = {
        "que", "con", "una", "por", "del", "los", "las", "como",
        "pero", "más", "esto", "este", "esta", "son", "sus",
        "puede", "han", "hay", "ser", "fue", "era", "para"
    }
    chinese_stop_words = {
        "的","了","在","是","我","他","她","它","们","这","那","和","有",
        "与","或","但","从","到","被","把","对","向","因为","所以"
    }

    stop_words = set(english_stop_words)
    if language == "ja":
        stop_words.update(japanese_stop_words)
    elif language == "es":
        stop_words.update(spanish_stop_words)
    elif language == "zh":
        stop_words.update(chinese_stop_words)

    text_lower = text.lower()
    for stop_word in stop_words:
        if language in {"ja", "zh"}:
            text_lower = text_lower.replace(stop_word, " ")

    if language in {"ja", "zh"}:
        known_terms = {
            "ja": [
                "経済", "市場", "投資", "金融", "株式", "操作", "心理", "規制",
                "技術", "社会", "政策", "環境", "教育", "研究", "分析", "影響",
                "発展", "行動", "情報", "システム",
            ],
            "zh": [
                "市场", "投资", "经济", "金融", "股票", "操纵", "心理", "监管",
                "技术", "社会", "政策", "环境", "教育", "研究", "分析", "影响",
                "发展", "行为", "信息", "系统",
            ],
        }[language]
        matches = []
        for term in known_terms:
            for match in re.finditer(re.escape(term), text_lower):
                matches.append((match.start(), term))
        words = [term for _position, term in sorted(matches)]
        if not words:
            cjk_chunks = re.findall(r"[\u3040-\u30ff\u4e00-\u9faf]{2,}", text_lower)
            words = []
            for chunk in cjk_chunks:
                if chunk in stop_words:
                    continue
                if len(chunk) <= 6:
                    words.append(chunk)
                    continue
                words.extend(chunk[index:index + 2] for index in range(len(chunk) - 1))
    else:
        words = re.findall(r"\b[a-záéíóúñü]{4,}\b", text_lower)
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
