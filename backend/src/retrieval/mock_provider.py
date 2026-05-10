from src.retrieval.base import ProviderEvidence

SLAVERY_TERMS = {
    "slavery",
    "enslavement",
    "enslaved",
    "abolition",
    "abolitionist",
    "transatlantic",
    "slave trade",
    "plantation",
    "plantation economy",
    "civil war",
    "emancipation",
    "human rights",
}

CLIMATE_TERMS = {
    "climate",
    "ocean",
    "marine",
    "biodiversity",
    "warming",
    "acidification",
    "coastal",
    "ecosystem",
    "species",
}

GENERIC_STOPWORDS = {
    "about",
    "after",
    "also",
    "because",
    "before",
    "between",
    "essay",
    "from",
    "have",
    "into",
    "that",
    "their",
    "there",
    "these",
    "this",
    "with",
    "would",
}


def _normalized_query(query: str) -> str:
    return " ".join(query.lower().replace("-", " ").split())


def _query_terms(query: str) -> set[str]:
    words = [word.strip(".,;:!?()[]{}\"'").lower() for word in query.split()]
    return {word for word in words if len(word) > 3 and word not in GENERIC_STOPWORDS}


def _matches_any(query: str, terms: set[str]) -> bool:
    normalized = _normalized_query(query)
    return any(term in normalized for term in terms)


def _topic_for_query(query: str) -> str:
    if _matches_any(query, SLAVERY_TERMS):
        return "slavery"
    if _matches_any(query, CLIMATE_TERMS):
        return "climate"
    return "generic"


def _has_topic_overlap(query: str, topic_terms: set[str]) -> bool:
    normalized = _normalized_query(query)
    word_terms = _query_terms(query)
    return any(term in normalized for term in topic_terms) or bool(word_terms & topic_terms)


def _generic_keyword(query: str) -> str:
    terms = sorted(_query_terms(query))
    return terms[0] if terms else "the selected claim"


class MockRetrievalProvider:
    def retrieve(self, query: str) -> list[ProviderEvidence]:
        topic = _topic_for_query(query)
        if topic == "slavery":
            return self._slavery_cards(query)
        if topic == "climate":
            return self._climate_cards(query)
        return self._generic_cards(query)

    def _slavery_cards(self, query: str) -> list[ProviderEvidence]:
        if not _has_topic_overlap(query, SLAVERY_TERMS):
            return []

        return [
            ProviderEvidence(
                id="mock-slavery-001",
                title="Slavery and the Making of the Atlantic World",
                authors=["Ira Berlin"],
                year="2010",
                journal="Atlantic History Review",
                sourceType="journal",
                sourceTier="high",
                url="https://doi.org/10.1080/atlantic-history.2010.1042",
                doi="https://doi.org/10.1080/atlantic-history.2010.1042",
                snippet="Historical synthesis connects forced migration, racialized labor systems, and Atlantic commerce to the development of slavery in the Americas.",
                relevanceExplanation="MVP demo source: fits because the selected text discusses slavery and this source gives historical context for slavery as an Atlantic labor system.",
            ),
            ProviderEvidence(
                id="mock-slavery-002",
                title="Abolition, Emancipation, and the Politics of Human Rights",
                authors=["Manisha Sinha"],
                year="2016",
                journal="Journal of Nineteenth-Century History",
                sourceType="journal",
                sourceTier="high",
                url="https://doi.org/10.1353/jnh.2016.0048",
                doi="https://doi.org/10.1353/jnh.2016.0048",
                snippet="The abolition movement is analyzed as a political and moral campaign that linked emancipation to broader claims about citizenship and human rights.",
                relevanceExplanation="MVP demo source: fits slavery-related essays that mention abolition, emancipation, civil rights, or the moral arguments against enslavement.",
            ),
            ProviderEvidence(
                id="mock-slavery-003",
                title="Plantation Economies and Enslaved Labor in the Nineteenth-Century South",
                authors=["Walter Johnson"],
                year="2013",
                publisher="University Historical Studies Project",
                sourceType="book",
                sourceTier="high",
                url="https://history-demo.example.edu/plantation-economies-enslaved-labor",
                snippet="Economic records and narrative accounts show how plantation production depended on coercive labor, land expansion, and racial control.",
                relevanceExplanation="MVP demo source: fits because the selected text concerns slavery and this source addresses the plantation economy built on enslaved labor.",
            ),
        ]

    def _climate_cards(self, query: str) -> list[ProviderEvidence]:
        if not _has_topic_overlap(query, CLIMATE_TERMS):
            return []

        return [
            ProviderEvidence(
                id="mock-climate-001",
                title="Climate-Driven Redistribution of Marine Biodiversity and Ecosystem Risk",
                authors=["Elena Ramirez", "Thomas W. Lee"],
                year="2023",
                journal="Journal of Marine Ecology and Policy",
                sourceType="journal",
                sourceTier="high",
                url="https://doi.org/10.1016/j.marpol.2023.105121",
                doi="https://doi.org/10.1016/j.marpol.2023.105121",
                snippet="Observed warming patterns are associated with poleward shifts in species distributions and measurable changes in community composition.",
                relevanceExplanation="MVP demo source: fits because the selected text mentions climate, ocean, marine, or biodiversity impacts.",
            ),
            ProviderEvidence(
                id="mock-climate-002",
                title="Ocean Warming Indicators and Marine Species Vulnerability Assessment",
                authors=["National Oceanic and Atmospheric Administration"],
                year="2024",
                publisher="NOAA Climate Program Office",
                sourceType="report",
                sourceTier="high",
                url="https://www.noaa.gov/education/resource-collections/ocean-coasts/ocean-acidification",
                snippet="Long-term ocean monitoring shows temperature and chemistry changes that can alter habitat suitability for marine organisms.",
                relevanceExplanation="MVP demo source: fits because the selected text concerns ocean change mechanisms and marine species vulnerability.",
            ),
            ProviderEvidence(
                id="mock-climate-003",
                title="Adaptive Capacity of Coastal Ecosystems Under Accelerating Environmental Change",
                authors=["Priya Natarajan", "Samuel Okafor", "Hannah Chen"],
                year="2021",
                journal="Conservation Science Review",
                sourceType="journal",
                sourceTier="high",
                url="https://conservation.university.edu/articles/coastal-ecosystem-adaptation",
                snippet="Meta-analysis results indicate that biodiversity outcomes vary by region, exposure, and local conservation management.",
                relevanceExplanation="MVP demo source: fits because the selected text relates to coastal ecosystems, biodiversity, or environmental change.",
            ),
        ]

    def _generic_cards(self, query: str) -> list[ProviderEvidence]:
        keyword = _generic_keyword(query)
        title_keyword = keyword.title()
        return [
            ProviderEvidence(
                id="mock-generic-001",
                title=f"Evaluating Evidence in Student Writing About {title_keyword}",
                authors=["Taylor Brown", "Amina Patel"],
                year="2022",
                journal="Research Methods Quarterly",
                sourceType="journal",
                sourceTier="medium",
                url="https://doi.org/10.5555/rmq.2022.0184",
                doi="https://doi.org/10.5555/rmq.2022.0184",
                snippet=f"Academic writing improves when claims about {keyword} are paired with source context, clear warrants, and discipline-appropriate evidence.",
                relevanceExplanation=f"MVP demo source: fits because it is a general academic-writing source tied to the selected keyword '{keyword}', not an unrelated topic.",
            ),
            ProviderEvidence(
                id="mock-generic-002",
                title=f"Source-Based Reasoning and Keyword-Focused Revision",
                authors=["Morgan Ellis"],
                year="2020",
                publisher="Center for Writing Studies",
                sourceType="report",
                sourceTier="medium",
                url="https://writing-demo.example.edu/source-based-reasoning",
                snippet=f"The report recommends checking whether evidence directly addresses the central terms of a claim, including terms such as {keyword}.",
                relevanceExplanation=f"MVP demo source: fits because the selected text does not match a specialized demo topic, so this source supports evidence use around '{keyword}'.",
            ),
        ]
