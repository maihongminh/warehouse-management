from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Sale, SaleItem, SaleStatus
from app.schemas.sale import SaleCompleteOut, SaleCreate, SaleOut, SaleWithItemsOut
from app.schemas.pagination import PaginatedResponse
from app.services import sale as sale_svc

router = APIRouter()


@router.post("", response_model=SaleWithItemsOut, status_code=201)
def create_sale(body: SaleCreate, db: Session = Depends(get_db)) -> Sale:
    sale = Sale(date=body.date, created_by=body.created_by, status=SaleStatus.draft, total_amount=0)
    db.add(sale)
    db.flush()
    for line in body.lines:
        db.add(
            SaleItem(
                sale_id=sale.id,
                product_id=line.product_id,
                batch_id=line.batch_id,
                quantity=line.quantity,
                sale_price=line.sale_price,
                import_price_snapshot=None,
            )
        )
    db.commit()
    return (
        db.query(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.product))
        .filter(Sale.id == sale.id)
        .first()
    )


@router.get("", response_model=PaginatedResponse[SaleOut])
def list_sales(
    db: Session = Depends(get_db),
    status: SaleStatus | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
) -> dict:
    q = db.query(Sale)
    if status is not None:
        q = q.filter(Sale.status == status)
    if date_from is not None:
        q = q.filter(Sale.date >= date_from)
    if date_to is not None:
        q = q.filter(Sale.date <= date_to)
    
    total = q.count()
    total_pages = (total + size - 1) // size
    items = q.order_by(Sale.id.desc()).offset((page - 1) * size).limit(size).all()
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": total_pages
    }


@router.get("/{sale_id}", response_model=SaleWithItemsOut)
def get_sale(sale_id: int, db: Session = Depends(get_db)) -> Sale:
    s = db.query(Sale).options(selectinload(Sale.items).selectinload(SaleItem.product)).filter(Sale.id == sale_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu bán hàng")
    return s


@router.post("/{sale_id}/complete", response_model=SaleCompleteOut)
def complete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    sale_date: date | None = Query(None, description="Ngày bán (mặc định hôm nay, dùng cho kiểm tra HSD)"),
) -> dict:
    try:
        sale = sale_svc.complete_sale_fefo(db, sale_id, sale_date=sale_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    s = (
        db.query(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.product))
        .filter(Sale.id == sale.id)
        .first()
    )
    return {"sale": s, "message": "completed"}


@router.post("/{sale_id}/cancel", response_model=SaleWithItemsOut)
def cancel_sale(sale_id: int, db: Session = Depends(get_db)) -> Sale:
    try:
        sale_svc.cancel_sale(db, sale_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    # Reload with items + product relationships
    s = (
        db.query(Sale)
        .options(selectinload(Sale.items).selectinload(SaleItem.product))
        .filter(Sale.id == sale_id)
        .first()
    )
    return s
