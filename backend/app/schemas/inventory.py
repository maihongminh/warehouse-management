from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class InventoryBatchRow(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_code: str
    expiry_date: date
    import_price: Decimal
    quantity_remaining: int
    created_at: datetime


class ProductInventoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    sku: str
    unit: str
    total_quantity: int
    batches: list[InventoryBatchRow]
