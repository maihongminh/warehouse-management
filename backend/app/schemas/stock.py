from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class StockAdjustmentCreate(BaseModel):
    batch_id: int
    actual_quantity: int = Field(..., ge=0)


class StockAdjustmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    batch_id: int
    system_quantity: int
    actual_quantity: int
    difference: int
    created_at: datetime
