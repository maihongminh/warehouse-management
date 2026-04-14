from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Batch, Product
from app.schemas.inventory import InventoryBatchRow, ProductInventoryOut

router = APIRouter()


@router.get("/products", response_model=list[ProductInventoryOut])
def inventory_by_product(
    db: Session = Depends(get_db),
    q: str | None = Query(None),
) -> list[dict]:
    stmt = db.query(Product).options(selectinload(Product.batches)).filter(Product.is_active.is_(True))
    if q:
        like = f"%{q}%"
        stmt = stmt.filter((Product.name.ilike(like)) | (Product.sku.ilike(like)))
    products = stmt.order_by(Product.name.asc()).all()
    out: list[dict] = []
    for p in products:
        batches = sorted(p.batches, key=lambda b: (b.expiry_date, b.id))
        total = int(sum(b.quantity_remaining for b in batches))
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "unit": p.unit,
                "default_import_price": p.default_import_price,
                "default_sale_price": p.default_sale_price,
                "conversion_rate": p.conversion_rate,
                "total_quantity": total,
                "batches": [InventoryBatchRow.model_validate(b) for b in batches],
            }
        )
    return out


@router.get("/batches/expiring", response_model=list[InventoryBatchRow])
def expiring_batches(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
) -> list[Batch]:
    from datetime import date, timedelta

    today = date.today()
    end = today + timedelta(days=days)
    return (
        db.query(Batch)
        .filter(
            Batch.expiry_date <= end,
            Batch.expiry_date >= today,
            Batch.quantity_remaining > 0,
        )
        .order_by(Batch.expiry_date.asc())
        .all()
    )
