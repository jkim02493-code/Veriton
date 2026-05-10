from fastapi.testclient import TestClient

from src.config.settings import Settings
from src.main import app
from src.retrieval.base import ProviderEvidence
from src.retrieval.live_provider import LiveAcademicRetrievalProvider
from src.services.evidence_service import retrieve_evidence
from src.services.query_understanding import source_age, source_age_bucket, understand_query


def card(title: str, snippet: str, year: str = "2022") -> ProviderEvidence:
    return ProviderEvidence(
        id=title,
        title=title,
        authors=["Test Author"],
        year=year,
        journal="Test Journal",
        sourceType="journal",
        sourceTier="high",
        url="https://example.org",
        doi=None,
        snippet=snippet,
        relevanceExplanation=f"Why this fits: it supports {title}.",
    )


def test_quantum_mechanics_rejects_car_mechanics_results():
    focus = understand_query("quantum mechanics")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Recent Advances in Quantum Mechanics", "Quantum theory explains wave functions and particles.", "2024"),
            card("Automotive Mechanics and Car Repair", "A guide to car mechanics and garage repair."),
        ],
    )

    titles = " ".join(result.title.lower() for result in filtered)
    assert "quantum" in titles
    assert "car repair" not in titles
    assert "automotive" not in titles


def test_subsequent_slavery_query_does_not_reuse_quantum_focus(monkeypatch):
    def fake_retrieve(self, focus, recency_preference="balanced"):
        if focus.search_query == "quantum mechanics":
            return [
                card("Introduction to Quantum Mechanics", "Quantum theory explains wave functions and particles."),
            ]
        if focus.search_query == "slavery":
            return [
                card("Slavery and Abolition in Atlantic History", "The study discusses enslaved labor, abolition, and emancipation."),
            ]
        return []

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "retrieve", fake_retrieve)
    quantum_result = retrieve_evidence("quantum mechanics", Settings(mock_mode=False))
    slavery_result = retrieve_evidence("slavery", Settings(mock_mode=False))

    assert quantum_result.search_focus == "quantum mechanics"
    assert "quantum" in quantum_result.cards[0].title.lower()
    assert slavery_result.search_focus == "slavery"
    slavery_titles = " ".join(card.title.lower() for card in slavery_result.cards)
    assert "slavery" in slavery_titles or "abolition" in slavery_titles
    assert "quantum" not in slavery_titles


def test_slavery_query_returns_history_sources(monkeypatch):
    def fake_retrieve(self, focus, recency_preference="balanced"):
        return [
            card("Slavery and Abolition in Atlantic History", "The study discusses enslaved labor, abolition, and emancipation."),
        ]

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "retrieve", fake_retrieve)
    result = retrieve_evidence("slavery", Settings(mock_mode=False))
    combined = " ".join(f"{item.title} {item.snippet}".lower() for item in result.cards)

    assert result.search_focus == "slavery"
    assert "slavery" in combined or "abolition" in combined


def test_climate_sentence_returns_climate_sources(monkeypatch):
    def fake_retrieve(self, focus, recency_preference="balanced"):
        return [
            card("Climate Change Impacts on Marine Biodiversity", "Climate warming affects marine species and ecosystems."),
        ]

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "retrieve", fake_retrieve)
    result = retrieve_evidence("Climate change is increasing risks to marine biodiversity.", Settings(mock_mode=False))

    assert result.search_focus == "climate change"
    assert result.cards
    assert "climate" in result.cards[0].title.lower()


def test_live_retrieval_failure_shows_unavailability_message(monkeypatch):
    def failed_retrieve(self, focus, recency_preference="balanced"):
        raise RuntimeError("network unavailable")

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "retrieve", failed_retrieve)
    client = TestClient(app)
    response = client.post("/evidence", json={"text": "quantum mechanics", "citationStyle": "APA"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["cards"] == []
    assert payload["evidence"] == []
    assert payload["error"] == "live_providers_unavailable"
    assert payload["message"] == "Live academic search is temporarily unavailable."
    assert payload["retry"] is True
    assert "Live academic search is temporarily unavailable." in payload["warnings"]
    assert all("MVP demo sources" not in warning for warning in payload["warnings"])


def test_openalex_failure_tries_crossref_next(monkeypatch):
    calls = []

    def failed_openalex(self, focus):
        calls.append("openalex")
        raise RuntimeError("openalex down")

    def crossref_success(self, focus):
        calls.append("crossref")
        return "https://api.crossref.org/works?query.bibliographic=quantum+mechanics&rows=8", [
            card("Recent Advances in Quantum Mechanics", "Quantum physics and wave functions.", "2024")
        ]

    def should_not_continue(self, focus):
        calls.append("unexpected")
        return "unused", []

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_openalex", failed_openalex)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_crossref", crossref_success)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_semantic_scholar", should_not_continue)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_arxiv", should_not_continue)

    result = retrieve_evidence("quantum mechanics", Settings(mock_mode=False))

    assert calls == ["openalex", "crossref"]
    assert result.cards
    assert result.live_unavailable is False


def test_all_four_live_providers_fail_returns_structured_unavailable(monkeypatch):
    def failed_provider(self, focus):
        raise RuntimeError("provider down")

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_openalex", failed_provider)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_crossref", failed_provider)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_semantic_scholar", failed_provider)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_arxiv", failed_provider)

    client = TestClient(app)
    response = client.post("/evidence", json={"text": "quantum mechanics", "citationStyle": "APA"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["cards"] == []
    assert payload["evidence"] == []
    assert payload["error"] == "live_providers_unavailable"
    assert payload["message"] == "Live academic search is temporarily unavailable."
    assert payload["retry"] is True
    assert payload["demoMode"] is False


def test_demo_sources_require_explicit_demo_mode(monkeypatch):
    def failed_provider(self, focus):
        raise RuntimeError("provider down")

    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_openalex", failed_provider)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_crossref", failed_provider)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_semantic_scholar", failed_provider)
    monkeypatch.setattr(LiveAcademicRetrievalProvider, "_arxiv", failed_provider)

    client = TestClient(app)
    live_response = client.post("/evidence", json={"text": "slavery", "citationStyle": "APA"})
    demo_response = client.post("/evidence", json={"text": "slavery", "citationStyle": "APA", "demoMode": True})

    live_payload = live_response.json()
    demo_payload = demo_response.json()
    assert live_payload["cards"] == []
    assert live_payload["demoMode"] is False
    assert "Demo sources — not live results." not in live_payload["warnings"]
    assert demo_payload["cards"]
    assert demo_payload["demoMode"] is True
    assert "Demo sources — not live results." in demo_payload["warnings"]


def test_climate_change_prefers_last_five_years_by_default():
    focus = understand_query("climate change")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Climate Change Impacts in Recent Scholarship", "Climate warming affects ecosystems.", "2024"),
            card("Climate Change in Earlier Environmental Research", "Climate warming affects ecosystems.", "2010"),
        ],
    )

    assert filtered
    assert filtered[0].year == "2024"
    assert all((source_age(result.year) or 999) <= 5 for result in filtered)


def test_current_year_is_dynamic_for_source_age(monkeypatch):
    import src.services.query_understanding as query_understanding

    monkeypatch.setattr(query_understanding, "current_year", lambda: 2032)

    assert source_age("2030") == 2
    assert source_age_bucket("2030") == "Recent"
    assert source_age_bucket("2020") == "Mid"
    assert source_age_bucket("2000") == "Foundational"


def test_balanced_mode_returns_mixed_date_buckets_when_available(monkeypatch):
    import src.services.query_understanding as query_understanding

    monkeypatch.setattr(query_understanding, "current_year", lambda: 2026)
    focus = understand_query("literature and historical theory")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Recent Literature and Historical Theory", "Literature history theory and criticism.", "2024"),
            card("Current Literature and Historical Criticism", "Literature history theory and criticism.", "2022"),
            card("Mid Period Literature and Historical Theory", "Literature history theory and criticism.", "2016"),
            card("Foundational Classic Literature Historical Theory", "Foundational classic theory in literature historical criticism.", "1998"),
        ],
    )

    buckets = [source_age_bucket(result.year) for result in filtered]
    assert "Recent" in buckets
    assert "Mid" in buckets
    assert "Foundational" in buckets


def test_fast_moving_academic_topics_prefer_recent_sources(monkeypatch):
    import src.services.query_understanding as query_understanding

    monkeypatch.setattr(query_understanding, "current_year", lambda: 2026)
    queries = [
        ("artificial intelligence ethics", "Artificial Intelligence Ethics in Recent Research", "Artificial intelligence ethics and technology policy."),
        ("quantum mechanics", "Quantum Mechanics in Contemporary Physics", "Quantum theory, particles, and wave functions."),
        ("medicine therapy outcomes", "Medicine Therapy Outcomes in Recent Clinical Research", "Medicine therapy outcomes in clinical research."),
    ]

    for query, recent_title, snippet in queries:
        focus = understand_query(query)
        provider = LiveAcademicRetrievalProvider()
        filtered = provider._rank_and_filter(
            focus,
            [
                card(recent_title, snippet, "2024"),
                card(recent_title.replace("Recent", "Older"), snippet, "2001"),
            ],
        )

        assert filtered
        assert filtered[0].year == "2024"
        assert all(source_age_bucket(result.year) == "Recent" for result in filtered)


def test_old_unrelated_source_never_outranks_recent_relevant_source(monkeypatch):
    import src.services.query_understanding as query_understanding

    monkeypatch.setattr(query_understanding, "current_year", lambda: 2026)
    focus = understand_query("climate change")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Climate Change Impacts in Recent Research", "Climate warming and emissions affect ecosystems.", "2024"),
            card("Classic Car Mechanics", "Automotive repair, garage mechanics, and engine maintenance.", "1985"),
        ],
    )

    assert filtered
    assert filtered[0].year == "2024"
    assert all("car" not in result.title.lower() for result in filtered)


def test_recent_filter_excludes_weak_old_sources():
    focus = understand_query("quantum mechanics")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Quantum Mechanics", "A weakly related older overview.", "1984"),
        ],
        recency_preference="recent",
    )

    assert filtered == []


def test_slavery_allows_directly_relevant_older_history_sources():
    focus = understand_query("slavery")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Slavery and Abolition in Historical Scholarship", "Historical work on enslaved labor and abolition.", "1988"),
            card("Academic Writing and Rhetoric", "A generic writing source.", "2024"),
        ],
    )

    titles = " ".join(result.title.lower() for result in filtered)
    assert "slavery" in titles
    assert "rhetoric" not in titles


def test_korean_history_focus_is_clean_academic_phrase():
    focus = understand_query("The history of Korea has been a long, vicious, and terrifying path.")

    assert focus.search_query == "korean history"
    assert focus.display_topic == "korean history"
    assert "history korea been long vicious terrifying path" != focus.search_query


def test_korean_history_rejects_emergency_medicine_sources():
    focus = understand_query("The history of Korea has been a long, vicious, and terrifying path.")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Korean History and Historical Trauma", "A study of Korean historical violence, war, and memory.", "2022"),
            card("Breaking News in Emergency Medicine", "Emergency medicine updates for clinical practice.", "2024"),
        ],
    )

    titles = " ".join(result.title.lower() for result in filtered)
    assert "korean history" in titles
    assert "emergency medicine" not in titles


def test_unrelated_results_are_filtered_to_empty():
    focus = understand_query("Korean history and historical trauma")
    provider = LiveAcademicRetrievalProvider()
    filtered = provider._rank_and_filter(
        focus,
        [
            card("Breaking News in Emergency Medicine", "Emergency medicine updates for clinical practice.", "2024"),
        ],
    )

    assert filtered == []
