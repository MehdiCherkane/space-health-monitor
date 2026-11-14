"""Interchange contracts; research results never constitute health rules."""
from typing import Literal
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict

Provenance = Literal['REAL_HISTORICAL', 'LIVE_MEASURED', 'SYNTHETIC', 'DERIVED']

class Observation(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    subject_id: str | None = Field(default=None, min_length=1)
    timestamp: datetime
    metric: str
    value: float | None
    unit: str
    source: str = Field(min_length=1)
    dataset_id: str
    provenance: Provenance
    mission_phase: str | None = None
    quality: str | None = None
    metadata: dict = Field(default_factory=dict)

class Candidate(BaseModel):
    id: str
    metrics: list[str]
    relationship: dict
    statistics: dict
    stability: dict
    dataset: dict
    confidence: Literal['STRONG', 'MODERATE', 'WEAK', 'INCONCLUSIVE']
    status: Literal['review_required'] = 'review_required'
    warnings: list[str]
