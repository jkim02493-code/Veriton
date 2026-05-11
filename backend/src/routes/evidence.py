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
