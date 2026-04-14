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
    supplier: str | None = None
    is_debt: bool = False
    lines: list[ImportLineIn] = Field(..., min_length=1)


class ImportItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    batch_id: int
    quantity: int
    import_price: Decimal
    product_name: str = ""

    @classmethod
    def from_orm_item(cls, item: object) -> "ImportItemOut":
        obj = cls.model_validate(item)
        try:
            obj.product_name = item.product.name  # type: ignore[union-attr]
        except Exception:
            obj.product_name = ""
        return obj


class ImportReceiptOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    created_by: str
    supplier: str | None
    is_debt: bool
    total_amount: Decimal
    items: list[ImportItemOut]


class ImportReceiptListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    created_by: str
    supplier: str | None
    is_debt: bool
    total_amount: Decimal
    item_count: int = 0
