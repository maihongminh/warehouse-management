from datetime import datetime
from pydantic import BaseModel, ConfigDict


class SupplierCreate(BaseModel):
    name: str
    phone: str | None = None
    address: str | None = None
    note: str | None = None


class SupplierUpdate(BaseModel):
    name: str | None = None
    phone: str | None = None
    address: str | None = None
    note: str | None = None
    is_active: bool | None = None


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str | None
    address: str | None
    note: str | None
    is_active: bool
    created_at: datetime
