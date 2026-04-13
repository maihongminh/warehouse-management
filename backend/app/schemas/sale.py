from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.models import SaleStatus


class SaleDraftLine(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    sale_price: Decimal = Field(..., ge=0)


class SaleCreate(BaseModel):
    date: date
    created_by: str = "system"
    lines: list[SaleDraftLine] = Field(default_factory=list)


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    batch_id: int | None
    quantity: int
    sale_price: Decimal
    import_price_snapshot: Decimal | None


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    total_amount: Decimal
    status: SaleStatus
    created_by: str


class SaleWithItemsOut(SaleOut):
    items: list[SaleItemOut]


class SaleCompleteOut(BaseModel):
    sale: SaleWithItemsOut
    message: str = "completed"
