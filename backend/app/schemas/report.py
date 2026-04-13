from datetime import date
from decimal import Decimal

from pydantic import BaseModel


class DashboardOut(BaseModel):
    revenue_today: Decimal
    profit_today: Decimal
    low_stock_count: int
    expiring_soon_count: int


class PeriodSummaryOut(BaseModel):
    date_from: date
    date_to: date
    revenue: Decimal
    profit: Decimal
    completed_sale_count: int
