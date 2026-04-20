import enum
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    Float,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


class SaleStatus(str, enum.Enum):
    draft = "draft"
    completed = "completed"
    cancelled = "cancelled"


class InventoryChangeType(str, enum.Enum):
    import_ = "import"
    sale = "sale"
    adjust = "adjust"
    return_ = "return"


class Supplier(Base):
    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    sku: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="unit")
    default_import_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    default_sale_price: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    conversion_rate: Mapped[int] = mapped_column(Integer, default=1)
    is_active: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    batches: Mapped[list["Batch"]] = relationship(back_populates="product")


class Batch(Base):
    __tablename__ = "batches"
    __table_args__ = (
        UniqueConstraint("product_id", "batch_code", "expiry_date", name="uq_batch_product_code_expiry"),
        Index("ix_batches_product_id", "product_id"),
        Index("ix_batches_expiry_date", "expiry_date"),
        CheckConstraint("quantity_remaining >= 0", name="ck_batch_qty_non_negative"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    batch_code: Mapped[str] = mapped_column(String(64), default="")
    expiry_date: Mapped[date] = mapped_column(Date, nullable=False)
    import_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    quantity_remaining: Mapped[float] = mapped_column(Float, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    product: Mapped["Product"] = relationship(back_populates="batches")


class ImportReceipt(Base):
    __tablename__ = "import_receipts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    created_by: Mapped[str] = mapped_column(String(128), default="system")
    supplier: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_debt: Mapped[bool] = mapped_column(Boolean, default=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=0)

    items: Mapped[list["ImportItem"]] = relationship(back_populates="receipt", cascade="all, delete-orphan")


class ImportItem(Base):
    __tablename__ = "import_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    receipt_id: Mapped[int] = mapped_column(ForeignKey("import_receipts.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    import_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    receipt: Mapped["ImportReceipt"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class Sale(Base):
    __tablename__ = "sales"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    date: Mapped[date] = mapped_column(Date, nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[SaleStatus] = mapped_column(
        SAEnum(SaleStatus, values_callable=lambda x: [e.value for e in x]),
        default=SaleStatus.draft,
    )
    created_by: Mapped[str] = mapped_column(String(128), default="system")

    items: Mapped[list["SaleItem"]] = relationship(back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id"), nullable=True)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)
    sale_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    import_price_snapshot: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    sale: Mapped["Sale"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()


class InventoryLog(Base):
    __tablename__ = "inventory_logs"
    __table_args__ = (Index("ix_inventory_logs_product_batch", "product_id", "batch_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    change_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    type: Mapped[InventoryChangeType] = mapped_column(
        SAEnum(InventoryChangeType, values_callable=lambda x: [e.value for e in x]),
        nullable=False,
    )
    ref_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StockAdjustment(Base):
    __tablename__ = "stock_adjustments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    system_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    actual_quantity: Mapped[float] = mapped_column(Float, nullable=False)
    difference: Mapped[float] = mapped_column(Float, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SaleReturn(Base):
    """Phếu trả hàng từ một hóa đơn đã hoàn tất."""
    __tablename__ = "sale_returns"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)

    sale: Mapped["Sale"] = relationship()
    items: Mapped[list["SaleReturnItem"]] = relationship(back_populates="return_receipt", cascade="all, delete-orphan")


class SaleReturnItem(Base):
    """Chi tiết từng dòng trả hàng."""
    __tablename__ = "sale_return_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    return_id: Mapped[int] = mapped_column(ForeignKey("sale_returns.id"), nullable=False)
    sale_item_id: Mapped[int] = mapped_column(ForeignKey("sale_items.id"), nullable=False)
    batch_id: Mapped[int] = mapped_column(ForeignKey("batches.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Float, nullable=False)  # Số lượng trả
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)

    return_receipt: Mapped["SaleReturn"] = relationship(back_populates="items")
    product: Mapped["Product"] = relationship()
