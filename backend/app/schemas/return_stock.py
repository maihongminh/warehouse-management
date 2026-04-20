from pydantic import BaseModel, Field


class CustomerReturnIn(BaseModel):
    batch_id: int
    quantity: float = Field(..., gt=0)
    ref_sale_id: int | None = None
