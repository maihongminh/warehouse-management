from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models import SaleStatus


class SaleDraftLine(BaseModel):
    product_id: int
    batch_id: int | None = None
    quantity: float = Field(..., gt=0)
    sale_price: Decimal = Field(..., ge=0)


class SaleCreate(BaseModel):
    date: date
    created_by: str = "system"
    lines: list[SaleDraftLine] = Field(default_factory=list)


class SaleItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
    product_name: str = ""
    batch_id: int | None
    quantity: float
    sale_price: Decimal
    import_price_snapshot: Decimal | None

    @model_validator(mode="before")
    @classmethod
    def extract_product_name(cls, data: Any) -> Any:
        """Khi khởi tạo từ ORM object, lấy tên sản phẩm từ relationship."""
        if hasattr(data, "product") and data.product is not None:
            # Set vào dict để pydantic đọc được
            from pydantic import BaseModel as _BM
            try:
                # data là SQLAlchemy ORM instance — chuyển qua dict tạm
                d = {
                    "id": data.id,
                    "product_id": data.product_id,
                    "product_name": data.product.name if data.product else "",
                    "batch_id": data.batch_id,
                    "quantity": data.quantity,
                    "sale_price": data.sale_price,
                    "import_price_snapshot": data.import_price_snapshot,
                }
                return d
            except Exception:
                pass
        return data


class SaleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    date: date
    total_amount: Decimal
    returned_amount: Decimal = Decimal("0")  # Tổng tiền đã trả hàng (tính theo giá bán gốc)
    status: SaleStatus
    created_by: str


class SaleWithItemsOut(SaleOut):
    items: list[SaleItemOut]


class SaleCompleteOut(BaseModel):
    sale: SaleWithItemsOut
    message: str = "completed"
