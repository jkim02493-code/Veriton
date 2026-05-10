from src.retrieval.mock_provider import MockRetrievalProvider
from src.schemas.evidence import EvidenceRequest
from pydantic import ValidationError


def test_slavery_query_returns_history_sources_without_climate_fallback():
    cards = MockRetrievalProvider().retrieve("An essay about slavery and abolition")
    titles = " ".join(card.title.lower() for card in cards)

    assert cards
    assert "slavery" in titles or "enslaved" in titles or "abolition" in titles
    assert "climate" not in titles
    assert "ocean" not in titles
    assert all("climate" not in card.relevanceExplanation.lower() for card in cards)


def test_exact_slavery_query_returns_slavery_evidence():
    request = EvidenceRequest(text="Slavery", citationStyle="APA")
    cards = MockRetrievalProvider().retrieve(request.text)
    combined = " ".join(f"{card.title} {card.relevanceExplanation}".lower() for card in cards)

    assert cards
    assert "slavery" in combined or "enslaved" in combined or "abolition" in combined
    assert "climate" not in combined
    assert "ocean" not in combined


def test_climate_query_returns_climate_sources():
    cards = MockRetrievalProvider().retrieve("Climate change affects marine biodiversity in the ocean")
    titles = " ".join(card.title.lower() for card in cards)

    assert cards
    assert "climate" in titles or "ocean" in titles or "ecosystem" in titles
    assert "slavery" not in titles


def test_generic_query_uses_selected_keyword_not_climate_fallback():
    cards = MockRetrievalProvider().retrieve("An essay about classroom technology and learning")
    combined = " ".join(f"{card.title} {card.snippet} {card.relevanceExplanation}".lower() for card in cards)

    assert cards
    assert "technology" in combined or "classroom" in combined or "learning" in combined
    assert "marine biodiversity" not in combined
    assert "ocean warming" not in combined


def test_command_path_query_is_rejected_as_invalid_selection():
    try:
        EvidenceRequest(text=r"..venv\Scripts\Activate.ps1", citationStyle="APA")
    except ValidationError as exc:
        assert "local path or shell command" in str(exc)
    else:
        raise AssertionError("Expected command/path-shaped selected text to be rejected")
