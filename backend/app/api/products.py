from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Batch, Product
from app.schemas.batch import BatchOut
from app.schemas.product import ProductCreate, ProductOut, ProductUpdate

router = APIRouter()


@router.get("", response_model=list[ProductOut])
def list_products(
    db: Session = Depends(get_db),
    active_only: bool = Query(True),
    q: str | None = Query(None, description="Search name or sku"),
) -> list[Product]:
    stmt = db.query(Product)
    if active_only:
        stmt = stmt.filter(Product.is_active.is_(True))
    if q:
        like = f"%{q}%"
        stmt = stmt.filter((Product.name.ilike(like)) | (Product.sku.ilike(like)))
    return stmt.order_by(Product.name.asc()).all()


@router.post("", response_model=ProductOut, status_code=201)
def create_product(body: ProductCreate, db: Session = Depends(get_db)) -> Product:
    exists = db.query(Product).filter(Product.sku == body.sku).first()
    if exists:
        raise HTTPException(status_code=400, detail="SKU already exists")
    p = Product(
        name=body.name,
        sku=body.sku,
        unit=body.unit,
        default_import_price=body.default_import_price,
        default_sale_price=body.default_sale_price,
        is_active=body.is_active,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: int, db: Session = Depends(get_db)) -> Product:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return p


@router.get("/{product_id}/batches", response_model=list[BatchOut])
def list_product_batches(product_id: int, db: Session = Depends(get_db)) -> list[Batch]:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    return (
        db.query(Batch)
        .filter(Batch.product_id == product_id, Batch.quantity_remaining > 0)
        .order_by(Batch.expiry_date.asc(), Batch.id.asc())
        .all()
    )


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(product_id: int, body: ProductUpdate, db: Session = Depends(get_db)) -> Product:
    p = db.get(Product, product_id)
    if not p:
        raise HTTPException(status_code=404, detail="Product not found")
    data = body.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p
