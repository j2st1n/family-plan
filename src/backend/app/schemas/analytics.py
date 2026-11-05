from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class HeatmapItem(BaseModel):
    date: str
    total_tasks: int
    completed_tasks: int
    completion_rate: int
    status: str


class CategoryStat(BaseModel):
    category: str
    total_tasks: int
    completed_tasks: int
    completion_rate: int


class HabitInsight(BaseModel):
    title: str
    completed_count: int
    total_count: int
    completion_rate: int


class StreakStats(BaseModel):
    current_streak_days: int
    longest_streak_days: int
    freeze_usages_count: int
    vacation_days_count: int


class StarStats(BaseModel):
    stars_earned: Decimal
    stars_spent: Decimal
    current_stars: Decimal


class InsightsResponse(BaseModel):
    best_habit: HabitInsight | None = None
    attention_needed: HabitInsight | None = None
    streak: StreakStats
    stars: StarStats


class AnalyticsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    child_id: UUID
    days: int
    start_date: str
    end_date: str
    heatmap: list[HeatmapItem]
    categories: list[CategoryStat]
    insights: InsightsResponse
