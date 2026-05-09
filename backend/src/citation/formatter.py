from dataclasses import dataclass
from typing import Literal

SourceType = Literal["journal", "book", "website", "report", "unknown"]


@dataclass(frozen=True)
class CitationInput:
    title: str
    authors: list[str]
    year: str | None = None
    journal: str | None = None
    publisher: str | None = None
    url: str | None = None
    doi: str | None = None
    sourceType: SourceType = "unknown"


def _split_name(name: str) -> tuple[str, str]:
    parts = name.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[-1], " ".join(parts[:-1])


def _initials(given: str) -> str:
    return " ".join(f"{part[0]}." for part in given.replace("-", " ").split() if part)


def _apa_authors(authors: list[str]) -> str:
    if not authors:
        return "Unknown author"
    formatted = []
    for author in authors:
        family, given = _split_name(author)
        formatted.append(f"{family}, {_initials(given)}".strip().rstrip(","))
    if len(formatted) == 1:
        return formatted[0]
    if len(formatted) == 2:
        return f"{formatted[0]}, & {formatted[1]}"
    return f"{', '.join(formatted[:-1])}, & {formatted[-1]}"


def _mla_authors(authors: list[str]) -> str:
    if not authors:
        return "Unknown author"
    first_family, first_given = _split_name(authors[0])
    first = f"{first_family}, {first_given}".strip().rstrip(",")
    if len(authors) == 1:
        return first
    if len(authors) == 2:
        second_family, second_given = _split_name(authors[1])
        second = f"{second_given} {second_family}".strip()
        return f"{first}, and {second}"
    return f"{first}, et al."


def format_apa(metadata: CitationInput) -> str:
    year = metadata.year or "n.d."
    title = metadata.title.rstrip(".")
    doi_or_url = metadata.doi or metadata.url
    suffix = f" {doi_or_url}" if doi_or_url else ""
    if metadata.sourceType == "journal" and metadata.journal:
        return f"{_apa_authors(metadata.authors)} ({year}). {title}. {metadata.journal}.{suffix}".strip()
    publisher = metadata.publisher or metadata.journal
    publisher_part = f" {publisher}." if publisher else ""
    return f"{_apa_authors(metadata.authors)} ({year}). {title}.{publisher_part}{suffix}".strip()


def format_mla(metadata: CitationInput) -> str:
    title = metadata.title.rstrip(".")
    year = metadata.year or "n.d."
    container = metadata.journal or metadata.publisher
    location = metadata.doi or metadata.url
    citation = f'{_mla_authors(metadata.authors)}. "{title}."'
    if container:
        citation += f" {container},"
    citation += f" {year}"
    if location:
        citation += f", {location}"
    return citation.rstrip(",") + "."


def format_citations(metadata: CitationInput) -> dict[str, str]:
    return {"apa": format_apa(metadata), "mla": format_mla(metadata)}
