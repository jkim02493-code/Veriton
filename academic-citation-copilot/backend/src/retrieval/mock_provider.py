from src.retrieval.base import ProviderEvidence


class MockRetrievalProvider:
    def retrieve(self, query: str) -> list[ProviderEvidence]:
        return [
            ProviderEvidence(
                id="mock-001",
                title="Climate-Driven Redistribution of Marine Biodiversity and Ecosystem Risk",
                authors=["Elena Ramirez", "Thomas W. Lee"],
                year="2023",
                journal="Journal of Marine Ecology and Policy",
                sourceType="journal",
                sourceTier="high",
                url="https://doi.org/10.1016/j.marpol.2023.105121",
                doi="https://doi.org/10.1016/j.marpol.2023.105121",
                snippet="Observed warming patterns are associated with poleward shifts in species distributions and measurable changes in community composition.",
                relevanceExplanation="Directly supports claims connecting climate change with marine biodiversity impacts.",
            ),
            ProviderEvidence(
                id="mock-002",
                title="Ocean Warming Indicators and Marine Species Vulnerability Assessment",
                authors=["National Oceanic and Atmospheric Administration"],
                year="2024",
                publisher="NOAA Climate Program Office",
                sourceType="report",
                sourceTier="high",
                url="https://www.noaa.gov/education/resource-collections/ocean-coasts/ocean-acidification",
                snippet="Long-term ocean monitoring shows temperature and chemistry changes that can alter habitat suitability for marine organisms.",
                relevanceExplanation="A high-trust government source for background evidence on ocean change mechanisms.",
            ),
            ProviderEvidence(
                id="mock-003",
                title="Adaptive Capacity of Coastal Ecosystems Under Accelerating Environmental Change",
                authors=["Priya Natarajan", "Samuel Okafor", "Hannah Chen"],
                year="2021",
                journal="Conservation Science Review",
                sourceType="journal",
                sourceTier="high",
                url="https://conservation.university.edu/articles/coastal-ecosystem-adaptation",
                snippet="Meta-analysis results indicate that biodiversity outcomes vary by region, exposure, and local conservation management.",
                relevanceExplanation="Adds nuance by showing that biodiversity effects depend on ecological context and management.",
            ),
        ]
