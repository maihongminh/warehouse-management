from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class InventoryBatchRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str | None = None
    product_sku: str | None = None
    batch_code: str
    expiry_date: date
    import_price: Decimal
    quantity_remaining: float
    created_at: datetime


class ProductInventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    unit: str
    default_import_price: Decimal
    default_sale_price: Decimal
    conversion_rate: int
    total_quantity: float
    batches: list[InventoryBatchRow]
