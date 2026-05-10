import re
from datetime import date
from dataclasses import dataclass
from typing import Literal


STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "about",
    "because",
    "but",
    "by",
    "can",
    "from",
    "has",
    "have",
    "how",
    "in",
    "into",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "their",
    "this",
    "to",
    "was",
    "were",
    "with",
    "been",
    "long",
    "path",
}

NAMED_CONCEPTS = [
    "quantum mechanics",
    "transatlantic slavery",
    "climate change",
    "behavioral economics",
    "slave trade",
    "civil war",
    "human rights",
    "plantation economy",
    "ocean acidification",
    "marine biodiversity",
    "korean history",
    "history of korea",
]

TOPIC_ALIASES = {
    "quantum mechanics": {"quantum", "mechanics", "physics", "wavefunction", "wave function", "particle", "theory"},
    "slavery": {"slavery", "enslaved", "enslavement", "abolition", "abolitionist", "emancipation", "slave", "plantation", "transatlantic"},
    "transatlantic slavery": {"slavery", "enslaved", "enslavement", "abolition", "slave", "transatlantic", "atlantic", "plantation"},
    "climate change": {"climate", "warming", "greenhouse", "carbon", "temperature", "emissions", "environment"},
    "marine biodiversity": {"marine", "ocean", "biodiversity", "species", "ecosystem", "coastal"},
    "behavioral economics": {"behavioral", "behavioural", "economics", "decision", "bias", "choice"},
    "korean history": {"korea", "korean", "history", "historical", "violence", "trauma", "war", "colonial", "colonialism"},
}

MISMATCH_ALIASES = {
    "quantum mechanics": {"car", "cars", "automobile", "automotive", "repair", "mechanic", "mechanics liens", "labor mechanics", "garage"},
    "slavery": {"writing", "rhetoric", "grammar", "composition"},
    "korean history": {"medicine", "medical", "emergency", "healthcare", "patient", "surgery", "breaking news"},
}

RECENT_TOPICS = {
    "science",
    "medicine",
    "technology",
    "economics",
    "psychology",
    "climate",
    "ai",
    "artificial intelligence",
    "policy",
    "quantum",
    "physics",
}

FOUNDATIONAL_TOPICS = {
    "history",
    "literature",
    "philosophy",
    "classics",
    "slavery",
}

FOUNDATIONAL_TERMS = {
    "foundational",
    "landmark",
    "classic",
    "seminal",
    "theory",
    "history",
    "historical",
    "archive",
    "primary text",
}

AgeBucket = Literal["Recent", "Mid", "Foundational"]


@dataclass(frozen=True)
class QueryFocus:
    original_text: str
    normalized_text: str
    search_query: str
    display_topic: str
    keywords: set[str]
    protected_concept: str | None = None
    recency_topic: str = "default"


def current_year() -> int:
    return date.today().year


def normalize_text(text: str) -> str:
    return " ".join(text.strip().lower().replace("-", " ").split())


def _tokens(text: str) -> list[str]:
    return re.findall(r"[a-z][a-z0-9']+", normalize_text(text))


def _detect_concept(normalized_text: str) -> str | None:
    for concept in NAMED_CONCEPTS:
        if concept in normalized_text:
            return concept
    if "slavery" in normalized_text or "enslaved" in normalized_text or "abolition" in normalized_text:
        return "slavery"
    if ("korea" in normalized_text or "korean" in normalized_text) and ("history" in normalized_text or "historical" in normalized_text):
        return "korean history"
    if "climate" in normalized_text and ("change" in normalized_text or "warming" in normalized_text):
        return "climate change"
    return None


def understand_query(text: str) -> QueryFocus:
    normalized = normalize_text(text)
    concept = _detect_concept(normalized)
    tokens = [token for token in _tokens(normalized) if token not in STOPWORDS and len(token) > 2]
    keywords = set(tokens)

    if concept:
        if concept == "history of korea":
            concept = "korean history"
        keywords.update(TOPIC_ALIASES.get(concept, set()))
        return QueryFocus(
            original_text=text,
            normalized_text=normalized,
            search_query=concept,
            display_topic=concept,
            keywords=keywords,
            protected_concept=concept,
            recency_topic=_recency_topic(concept, keywords),
        )

    concise_terms = _clean_focus_terms(tokens)
    search_query = " ".join(concise_terms) if concise_terms else normalized[:120]
    return QueryFocus(
        original_text=text,
        normalized_text=normalized,
        search_query=search_query,
        display_topic=search_query or text.strip(),
        keywords=set(concise_terms),
        protected_concept=None,
        recency_topic=_recency_topic(search_query, set(concise_terms)),
    )


def relevance_score(focus: QueryFocus, title: str, snippet: str, source_type: str, year: str | None, recency_preference: str = "balanced") -> float:
    haystack = normalize_text(f"{title} {snippet}")
    title_text = normalize_text(title)
    score = 0.0

    if focus.protected_concept and focus.protected_concept in haystack:
        score += 6.0
    if focus.search_query and focus.search_query in title_text:
        score += 5.0
    elif focus.search_query and focus.search_query in haystack:
        score += 3.0

    overlap = sum(1 for keyword in focus.keywords if keyword in haystack)
    score += min(overlap, 6) * 1.2
    if focus.keywords and overlap == 0:
        score -= 4.0

    if source_type == "journal":
        score += 2.0
    elif source_type in {"book", "report"}:
        score += 1.0

    try:
        score += recency_score(focus, int(year), title, snippet, recency_preference)
    except ValueError:
        pass

    return score


def source_age(year: int | str | None) -> int | None:
    try:
        parsed_year = int(year or 0)
    except (TypeError, ValueError):
        return None
    if parsed_year <= 0:
        return None
    return max(0, current_year() - parsed_year)


def source_age_bucket(year: int | str | None) -> AgeBucket | None:
    age = source_age(year)
    if age is None:
        return None
    if age <= 5:
        return "Recent"
    if age <= 15:
        return "Mid"
    return "Foundational"


def recency_label(year: int | str | None, title: str = "", snippet: str = "", focus: QueryFocus | None = None) -> str | None:
    bucket = source_age_bucket(year)
    if not bucket:
        return None
    if bucket == "Foundational" and focus and not is_foundational_source(focus, title, snippet):
        return "Older"
    return bucket


def recency_score(focus: QueryFocus, year: int, title: str, snippet: str, recency_preference: str = "balanced") -> float:
    age = source_age(year)
    if age is None:
        return 0.0
    foundational = is_foundational_source(focus, title, snippet)

    if recency_preference == "foundational":
        if foundational:
            return 3.0
        if age <= 5:
            return 1.5
        if age <= 10:
            return 1.0
        return -0.5

    if recency_preference == "recent":
        if age <= 5:
            return 4.5
        if age <= 15:
            return 0.5 if focus.recency_topic != "strong" else -1.5
        return -6.0 if not foundational else -2.5

    if focus.recency_topic == "strong":
        if age <= 5:
            return 4.0
        if age <= 15:
            return 1.5
        return -5.0 if not foundational else -1.0

    if focus.recency_topic == "foundational":
        if age <= 5:
            return 2.0
        if age <= 15:
            return 1.4
        if foundational:
            return 0.8
        return -1.0

    if age <= 5:
        return 2.5
    if age <= 15:
        return 2.0
    if foundational:
        return 0.4
    return -2.0


def passes_recency_guard(focus: QueryFocus, year: str | None, title: str, snippet: str, recency_preference: str = "balanced") -> bool:
    age = source_age(year)
    if age is None:
        return recency_preference != "recent"

    foundational = is_foundational_source(focus, title, snippet)
    strong_match = topical_match_strength(focus, title, snippet)
    if recency_preference == "recent":
        return age <= 5 or (age <= 15 and strong_match >= 5)
    if focus.recency_topic == "strong":
        return age <= 5 or (age <= 15 and strong_match >= 5) or (foundational and strong_match >= 7)
    if age > 15 and not foundational and strong_match < 6:
        return False
    return True


def is_foundational_source(focus: QueryFocus, title: str, snippet: str) -> bool:
    haystack = normalize_text(f"{title} {snippet}")
    if focus.recency_topic == "foundational":
        return True
    return any(term in haystack for term in FOUNDATIONAL_TERMS)


def topical_match_strength(focus: QueryFocus, title: str, snippet: str) -> int:
    haystack = normalize_text(f"{title} {snippet}")
    strength = 0
    if focus.protected_concept and focus.protected_concept in haystack:
        strength += 4
    if focus.search_query and focus.search_query in normalize_text(title):
        strength += 3
    elif focus.search_query and focus.search_query in haystack:
        strength += 2
    strength += sum(1 for keyword in focus.keywords if _contains_term(haystack, keyword))
    return strength


def _recency_topic(topic: str, keywords: set[str]) -> str:
    haystack = {token for token in _tokens(topic)} | keywords
    if haystack & RECENT_TOPICS:
        return "strong"
    if haystack & FOUNDATIONAL_TOPICS:
        return "foundational"
    return "default"


def is_clear_mismatch(focus: QueryFocus, title: str, snippet: str) -> bool:
    haystack = normalize_text(f"{title} {snippet}")
    if focus.keywords and not any(_contains_term(haystack, keyword) for keyword in focus.keywords):
        return True
    if focus.protected_concept in MISMATCH_ALIASES:
        return any(_contains_term(haystack, term) for term in MISMATCH_ALIASES[focus.protected_concept or ""])
    return False


def _contains_term(haystack: str, term: str) -> bool:
    normalized_term = normalize_text(term)
    if " " in normalized_term:
        return normalized_term in haystack
    return re.search(rf"\b{re.escape(normalized_term)}\b", haystack) is not None


def _clean_focus_terms(tokens: list[str]) -> list[str]:
    descriptive_noise = {"vicious", "terrifying", "very", "really", "thing", "stuff", "essay", "support", "claim"}
    terms = [token for token in tokens if token not in descriptive_noise]
    if "korea" in terms and "history" in terms:
        focus = ["korean", "history"]
        if any(token in terms for token in {"violence", "violent", "vicious", "terrifying", "trauma", "war"}):
            focus.append("violence")
        return focus
    return terms[:5]
