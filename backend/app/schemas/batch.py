from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    batch_code: str
    expiry_date: date
    import_price: Decimal
    quantity_remaining: float
    created_at: datetime
