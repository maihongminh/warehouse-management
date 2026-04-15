from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Batch, Product
from app.schemas.inventory import InventoryBatchRow, ProductInventoryOut
from app.schemas.pagination import PaginatedResponse

router = APIRouter()


@router.get("/products", response_model=PaginatedResponse[ProductInventoryOut])
def inventory_by_product(
    db: Session = Depends(get_db),
    q: str | None = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
) -> dict:
    stmt = db.query(Product).options(selectinload(Product.batches)).filter(Product.is_active.is_(True))
    if q:
        like = f"%{q}%"
        stmt = stmt.filter((Product.name.ilike(like)) | (Product.sku.ilike(like)))
    
    total = stmt.count()
    total_pages = (total + size - 1) // size
    
    products = stmt.order_by(Product.name.asc()).offset((page - 1) * size).limit(size).all()
    
    out: list[dict] = []
    for p in products:
        batches = sorted(p.batches, key=lambda b: (b.expiry_date, b.id))
        total_p = int(sum(b.quantity_remaining for b in batches))
        out.append(
            {
                "id": p.id,
                "name": p.name,
                "sku": p.sku,
                "unit": p.unit,
                "default_import_price": str(p.default_import_price),
                "default_sale_price": str(p.default_sale_price),
                "conversion_rate": p.conversion_rate,
                "total_quantity": total_p,
                "batches": [InventoryBatchRow.model_validate(b) for b in batches],
            }
        )
    return {
        "items": out,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": total_pages
    }


@router.get("/batches/expiring", response_model=PaginatedResponse[InventoryBatchRow])
def expiring_batches(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
) -> dict:
    from datetime import date, timedelta

    today = date.today()
    end = today + timedelta(days=days)
    
    q = (
        db.query(Batch)
        .filter(
            Batch.expiry_date <= end,
            Batch.expiry_date >= today,
            Batch.quantity_remaining > 0,
        )
    )
    
    total = q.count()
    total_pages = (total + size - 1) // size
    items = q.order_by(Batch.expiry_date.asc()).offset((page - 1) * size).limit(size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": total_pages
    }
