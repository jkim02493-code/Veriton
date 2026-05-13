from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from src.config.settings import Settings
from src.schemas.evidence import EvidenceCard, UsageState

FREE_SEARCH_LIMIT = 10
PRO_DAILY_SEARCH_LIMIT = 10
DEFAULT_SUPABASE_URL = "https://tgvrjlkksdzrtjmqmthw.supabase.co"
DEFAULT_SUPABASE_ANON_KEY = "sb_publishable_g47iQek89ST9UEmpIm0KMw_pOzZTJWr"


class SupabaseConfigError(RuntimeError):
    pass


class UsageLimitError(RuntimeError):
    def __init__(self, message: str, usage: UsageState) -> None:
        super().__init__(message)
        self.usage = usage


@dataclass(frozen=True)
class AuthenticatedUser:
    id: str
    email: str | None
    token: str


@dataclass(frozen=True)
class UserProfile:
    id: str
    email: str | None
    plan: str
    lifetime_searches: int
    searches_today: int
    last_reset_date: str | None
    stripe_customer_id: str | None = None


def require_supabase_config(settings: Settings) -> tuple[str, str]:
    supabase_url = (settings.supabase_url or DEFAULT_SUPABASE_URL).strip().rstrip("/")
    supabase_anon_key = (settings.supabase_anon_key or DEFAULT_SUPABASE_ANON_KEY).strip()
    if not supabase_url or not supabase_anon_key:
        raise SupabaseConfigError("Supabase is not configured.")
    return supabase_url, supabase_anon_key


def _auth_headers(settings: Settings, token: str, *, prefer: str | None = None) -> dict[str, str]:
    _supabase_url, anon_key = require_supabase_config(settings)
    headers = {
        "apikey": anon_key,
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    if prefer:
        headers["Prefer"] = prefer
    return headers


def _rest_url(settings: Settings, table: str) -> str:
    supabase_url, _anon_key = require_supabase_config(settings)
    return f"{supabase_url}/rest/v1/{table}"


def _as_profile(row: dict[str, Any]) -> UserProfile:
    return UserProfile(
        id=row["id"],
        email=row.get("email"),
        plan=row.get("plan") or "free",
        lifetime_searches=int(row.get("lifetime_searches") or 0),
        searches_today=int(row.get("searches_today") or 0),
        last_reset_date=row.get("last_reset_date"),
        stripe_customer_id=row.get("stripe_customer_id"),
    )


def verify_supabase_jwt(authorization: str | None, settings: Settings) -> AuthenticatedUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Authentication required."})

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Authentication required."})

    supabase_url, anon_key = require_supabase_config(settings)
    response = httpx.get(
        f"{supabase_url}/auth/v1/user",
        headers={"apikey": anon_key, "Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if response.status_code >= 400:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Invalid or expired session."})

    payload = response.json()
    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail={"message": "Invalid or expired session."})
    return AuthenticatedUser(id=user_id, email=payload.get("email"), token=token)


def ensure_user_profile(user: AuthenticatedUser, settings: Settings) -> UserProfile:
    profile = get_user_profile(user, settings)
    if profile:
        return profile

    today = datetime.now(UTC).date().isoformat()
    response = httpx.post(
        _rest_url(settings, "users"),
        headers=_auth_headers(settings, user.token, prefer="resolution=merge-duplicates,return=representation"),
        json={
            "id": user.id,
            "email": user.email,
            "plan": "free",
            "lifetime_searches": 0,
            "searches_today": 0,
            "last_reset_date": today,
        },
        timeout=10,
    )
    _raise_for_supabase_error(response)
    rows = response.json()
    if isinstance(rows, list) and rows:
        return _as_profile(rows[0])
    return get_user_profile(user, settings) or UserProfile(user.id, user.email, "free", 0, 0, today)


def get_user_profile(user: AuthenticatedUser, settings: Settings) -> UserProfile | None:
    response = httpx.get(
        _rest_url(settings, "users"),
        headers=_auth_headers(settings, user.token),
        params={"id": f"eq.{user.id}", "select": "*", "limit": "1"},
        timeout=10,
    )
    _raise_for_supabase_error(response)
    rows = response.json()
    if not rows:
        return None
    return _as_profile(rows[0])


def usage_from_profile(profile: UserProfile) -> UsageState:
    today_date = datetime.now(UTC).date()
    today = today_date.isoformat()
    if profile.plan == "pro":
        searches_today = profile.searches_today if profile.last_reset_date == today else 0
        return UsageState(
            plan="pro",
            lifetimeSearches=profile.lifetime_searches,
            searchesToday=searches_today,
            remainingSearches=max(PRO_DAILY_SEARCH_LIMIT - searches_today, 0),
            limit=PRO_DAILY_SEARCH_LIMIT,
            resetsAt=datetime.combine(today_date + timedelta(days=1), datetime.min.time(), tzinfo=UTC).isoformat(),
        )
    return UsageState(
        plan="free",
        lifetimeSearches=profile.lifetime_searches,
        searchesToday=profile.searches_today,
        remainingSearches=max(FREE_SEARCH_LIMIT - profile.lifetime_searches, 0),
        limit=FREE_SEARCH_LIMIT,
        resetsAt=None,
    )


def enforce_and_increment_search_limit(user: AuthenticatedUser, settings: Settings) -> UsageState:
    profile = ensure_user_profile(user, settings)
    today = datetime.now(UTC).date().isoformat()
    updates: dict[str, Any]

    if profile.plan == "pro":
        searches_today = profile.searches_today if profile.last_reset_date == today else 0
        if searches_today >= PRO_DAILY_SEARCH_LIMIT:
            raise UsageLimitError("You have reached your 10 searches for today. Resets at midnight UTC.", usage_from_profile(profile))
        updates = {
            "lifetime_searches": profile.lifetime_searches + 1,
            "searches_today": searches_today + 1,
            "last_reset_date": today,
        }
    else:
        if profile.lifetime_searches >= FREE_SEARCH_LIMIT:
            raise UsageLimitError("You have used all 10 of your free searches. Upgrade to Pro to continue.", usage_from_profile(profile))
        updates = {
            "lifetime_searches": profile.lifetime_searches + 1,
            "last_reset_date": profile.last_reset_date or today,
        }

    response = httpx.patch(
        _rest_url(settings, "users"),
        headers=_auth_headers(settings, user.token, prefer="return=representation"),
        params={"id": f"eq.{user.id}"},
        json=updates,
        timeout=10,
    )
    _raise_for_supabase_error(response)
    rows = response.json()
    updated_profile = _as_profile(rows[0]) if rows else ensure_user_profile(user, settings)
    return usage_from_profile(updated_profile)


def get_seen_source_urls(user: AuthenticatedUser, settings: Settings) -> list[str]:
    response = httpx.get(
        _rest_url(settings, "seen_sources"),
        headers=_auth_headers(settings, user.token),
        params={"user_id": f"eq.{user.id}", "select": "source_url"},
        timeout=10,
    )
    _raise_for_supabase_error(response)
    return [row["source_url"] for row in response.json() if row.get("source_url")]


def save_seen_sources(user: AuthenticatedUser, settings: Settings, source_urls: list[str]) -> None:
    rows = [{"user_id": user.id, "source_url": url} for url in dict.fromkeys(source_urls) if url]
    if not rows:
        return
    response = httpx.post(
        _rest_url(settings, "seen_sources"),
        headers=_auth_headers(settings, user.token, prefer="resolution=ignore-duplicates"),
        params={"on_conflict": "user_id,source_url"},
        json=rows,
        timeout=10,
    )
    if response.status_code == 400 and _supabase_error_code(response) == "42P10":
        response = httpx.post(
            _rest_url(settings, "seen_sources"),
            headers=_auth_headers(settings, user.token),
            json=rows,
            timeout=10,
        )
    _raise_for_supabase_error(response)


def save_search_history(user: AuthenticatedUser, settings: Settings, query: str, cards: list[EvidenceCard]) -> None:
    response = httpx.post(
        _rest_url(settings, "search_history"),
        headers=_auth_headers(settings, user.token),
        json={
            "user_id": user.id,
            "query": query,
            "sources_returned": [card.model_dump(mode="json") for card in cards],
        },
        timeout=10,
    )
    _raise_for_supabase_error(response)


def star_source(user: AuthenticatedUser, settings: Settings, source: EvidenceCard) -> dict[str, Any]:
    response = httpx.post(
        _rest_url(settings, "starred_sources"),
        headers=_auth_headers(settings, user.token, prefer="return=representation"),
        json={
            "user_id": user.id,
            "source_title": source.title,
            "authors": ", ".join(source.authors),
            "url": source.url or source.doi,
            "citation_apa": source.apaCitation,
            "citation_mla": source.mlaCitation,
            "year": source.year,
        },
        timeout=10,
    )
    _raise_for_supabase_error(response)
    rows = response.json()
    return rows[0] if isinstance(rows, list) and rows else {}


def delete_starred_source(user: AuthenticatedUser, settings: Settings, source_id: str) -> None:
    response = httpx.delete(
        _rest_url(settings, "starred_sources"),
        headers=_auth_headers(settings, user.token),
        params={"id": f"eq.{source_id}", "user_id": f"eq.{user.id}"},
        timeout=10,
    )
    _raise_for_supabase_error(response)


def get_starred_sources(user: AuthenticatedUser, settings: Settings) -> list[dict[str, Any]]:
    response = httpx.get(
        _rest_url(settings, "starred_sources"),
        headers=_auth_headers(settings, user.token),
        params={"user_id": f"eq.{user.id}", "select": "*", "order": "starred_at.desc"},
        timeout=10,
    )
    _raise_for_supabase_error(response)
    return response.json()


def get_search_history(user: AuthenticatedUser, settings: Settings) -> list[dict[str, Any]]:
    response = httpx.get(
        _rest_url(settings, "search_history"),
        headers=_auth_headers(settings, user.token),
        params={"user_id": f"eq.{user.id}", "select": "*", "order": "searched_at.desc"},
        timeout=10,
    )
    _raise_for_supabase_error(response)
    return response.json()


def _raise_for_supabase_error(response: httpx.Response) -> None:
    if response.status_code < 400:
        return
    try:
        detail = response.json()
    except ValueError:
        detail = response.text
    raise HTTPException(status_code=response.status_code, detail=detail)


def _supabase_error_code(response: httpx.Response) -> str | None:
    try:
        detail = response.json()
    except ValueError:
        return None
    if isinstance(detail, dict):
        code = detail.get("code")
        return str(code) if code else None
    return None
