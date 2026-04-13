from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ImportLineIn(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    import_price: Decimal = Field(..., ge=0)
    batch_code: str = ""
    expiry_date: date


class ImportReceiptCreate(BaseModel):
    date: date
    created_by: str = "system"
    lines: list[ImportLineIn] = Field(..., min_length=1)


class ImportItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    batch_id: int
    quantity: int
    import_price: Decimal


class ImportReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    created_by: str
    items: list[ImportItemOut]
