from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockAdjustmentCreate(BaseModel):
    batch_id: int
    actual_quantity: float = Field(..., ge=0)


class StockAdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    system_quantity: float
    actual_quantity: float
    difference: float
    created_at: datetime
