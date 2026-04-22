from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field


class ReturnLineIn(BaseModel):
    sale_item_id: int
    quantity: int = Field(..., gt=0)


class SaleReturnCreate(BaseModel):
    items: list[ReturnLineIn] = Field(..., min_length=1)
    note: str | None = None


class SaleReturnItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_item_id: int
    batch_id: int
    product_id: int
    quantity: int
    product_name: str = ""


class SaleReturnOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sale_id: int
    note: str | None
    created_at: datetime
    items: list[SaleReturnItemOut]
