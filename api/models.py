"""SEO Studio Templates — Pydantic Data Models
Matches TypeScript input schemas in /validators/schemas/index.ts and /shared/schemas/
"""

from __future__ import annotations

from typing import Optional

try:
    from pydantic import BaseModel, Field
except ImportError:
    # Minimal fallback dataclass wrapper if pydantic is not yet installed in local python env
    class BaseModel:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)
        def model_dump(self):
            return self.__dict__
    def Field(default=..., **_kwargs):
        return default


class DestinationGuideModel(BaseModel):
    hotelName: str
    brand: str = "Independent Collection"
    cityName: str
    destinationTitle: str
    destinationSubtitle: str = "Premier travel insights and local recommendations"
    destinationOverview: str
    amenitiesList: str = "modern luxury amenities, on-site dining, and 24/7 guest services"
    bookingPerks: str = "lowest direct booking rate guarantee and flexible cancellations"
    attractionsSummary: str = "convenient access to cultural attractions, dining districts, and local transit"


class RoomShowcaseModel(BaseModel):
    hotelName: str
    cityName: str
    roomTitle: str
    roomStartingRate: str = "Best Available Rate"
    roomDescription: str
    roomAmenities: str = "King pillow-top bed, high-speed WiFi, smart television, and luxury bath amenities"


class HotelFaqModel(BaseModel):
    hotelName: str
    cityName: str
    checkInOutPolicy: str = "Check-in begins at 4:00 PM; check-out is by 11:00 AM."
    parkingPolicy: str = "On-site valet parking is available 24/7 for all registered guests."
    petPolicy: str = "Designated pet-friendly rooms are available upon request."


class PageMetadataModel(BaseModel):
    title: str
    metaDescription: str
    canonicalUrl: str
    robotsDirective: str = "index, follow"
    focusKeyword: Optional[str] = None


class SiteManifestItemModel(BaseModel):
    url: str
    primaryKeyword: str
    secondaryTags: list[str] = []
    parentPage: Optional[str] = None
    categoryHierarchy: list[str] = []
    approvedAnchorVariations: list[str] = []
