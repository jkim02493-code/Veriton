from src.citation.formatter import CitationInput, format_citations


def test_single_author_journal_with_doi():
    result = format_citations(CitationInput(title="Marine biodiversity change", authors=["Jane Smith"], year="2021", journal="Journal of Marine Science", doi="https://doi.org/10.1000/test", sourceType="journal"))
    assert result["apa"] == "Smith, J. (2021). Marine biodiversity change. Journal of Marine Science. https://doi.org/10.1000/test"
    assert result["mla"] == 'Smith, Jane. "Marine biodiversity change." Journal of Marine Science, 2021, https://doi.org/10.1000/test.'


def test_two_authors():
    result = format_citations(CitationInput(title="Evidence literacy", authors=["Jane Smith", "Alex Kim"], year="2020", publisher="University Press", sourceType="book"))
    assert "Smith, J., & Kim, A." in result["apa"]
    assert "Smith, Jane, and Alex Kim" in result["mla"]


def test_three_or_more_authors():
    result = format_citations(CitationInput(title="Climate impacts", authors=["Jane Smith", "Alex Kim", "Maria Garcia"], year="2019", journal="Climate Research", sourceType="journal"))
    assert "Smith, J., Kim, A., & Garcia, M." in result["apa"]
    assert "Smith, Jane, et al." in result["mla"]


def test_missing_year():
    result = format_citations(CitationInput(title="Undated source", authors=["Jane Smith"], sourceType="unknown"))
    assert "(n.d.)" in result["apa"]
    assert "n.d." in result["mla"]


def test_missing_doi():
    result = format_citations(CitationInput(title="No DOI article", authors=["Jane Smith"], year="2022", journal="Open Review", sourceType="journal"))
    assert "https://doi.org" not in result["apa"]


def test_website_source():
    result = format_citations(CitationInput(title="Ocean indicators", authors=["NOAA Research"], year="2023", publisher="National Oceanic and Atmospheric Administration", url="https://www.noaa.gov/education", sourceType="website"))
    assert "National Oceanic and Atmospheric Administration" in result["apa"]
    assert "https://www.noaa.gov/education" in result["mla"]


def test_journal_source():
    result = format_citations(CitationInput(title="Academic evidence", authors=["Taylor Brown"], year="2018", journal="Research Methods Quarterly", sourceType="journal"))
    assert "Research Methods Quarterly" in result["apa"]
    assert "Research Methods Quarterly" in result["mla"]
