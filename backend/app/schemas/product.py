from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ProductBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str = Field(..., min_length=1, max_length=64)
    unit: str = Field(default="unit", max_length=32)
    default_import_price: Decimal = Field(default=Decimal("0"))
    default_sale_price: Decimal = Field(default=Decimal("0"))
    conversion_rate: int = Field(default=1, ge=1)
    is_active: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = None
    unit: str | None = None
    default_import_price: Decimal | None = None
    default_sale_price: Decimal | None = None
    conversion_rate: int | None = None
    is_active: bool | None = None


class ProductOut(ProductBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime
