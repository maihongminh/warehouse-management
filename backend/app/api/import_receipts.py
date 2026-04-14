from datetime import date
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import ImportItem, ImportReceipt, Product
from app.schemas.import_receipt import (
    ImportReceiptCreate,
    ImportReceiptListItem,
    ImportReceiptOut,
    ImportItemOut,
)
from app.services import import_receipt as import_svc

router = APIRouter()


@router.post("", response_model=ImportReceiptOut, status_code=201)
def create_receipt(body: ImportReceiptCreate, db: Session = Depends(get_db)) -> ImportReceipt:
    lines = [li.model_dump() for li in body.lines]
    try:
        receipt = import_svc.create_import_receipt(
            db,
            receipt_date=body.date,
            created_by=body.created_by,
            supplier=body.supplier,
            is_debt=body.is_debt,
            lines=lines,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    r = (
        db.query(ImportReceipt)
        .options(selectinload(ImportReceipt.items).selectinload(ImportItem.product))
        .filter(ImportReceipt.id == receipt.id)
        .first()
    )
    return _build_receipt_out(r)


@router.get("", response_model=list[ImportReceiptListItem])
def list_receipts(
    db: Session = Depends(get_db),
    is_debt: bool | None = Query(None),
    product_name: str | None = Query(None),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    supplier: str | None = Query(None),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
) -> list[dict]:
    q = db.query(ImportReceipt)

    if is_debt is not None:
        q = q.filter(ImportReceipt.is_debt == is_debt)
    if date_from is not None:
        q = q.filter(ImportReceipt.date >= date_from)
    if date_to is not None:
        q = q.filter(ImportReceipt.date <= date_to)
    if supplier:
        q = q.filter(ImportReceipt.supplier.ilike(f"%{supplier}%"))
    if product_name:
        q = q.join(ImportReceipt.items).join(ImportItem.product).filter(
            Product.name.ilike(f"%{product_name}%")
        ).distinct()

    receipts = (
        q.options(selectinload(ImportReceipt.items))
        .order_by(ImportReceipt.id.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    result = []
    for r in receipts:
        result.append({
            "id": r.id,
            "date": r.date,
            "created_by": r.created_by,
            "supplier": r.supplier,
            "is_debt": r.is_debt,
            "total_amount": r.total_amount,
            "item_count": len(r.items),
        })
    return result


@router.get("/{receipt_id}", response_model=ImportReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)) -> ImportReceipt:
    r = (
        db.query(ImportReceipt)
        .options(selectinload(ImportReceipt.items).selectinload(ImportItem.product))
        .filter(ImportReceipt.id == receipt_id)
        .first()
    )
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return _build_receipt_out(r)

@router.patch("/{receipt_id}/pay", response_model=ImportReceiptOut)
def pay_debt(receipt_id: int, db: Session = Depends(get_db)) -> dict:
    r = db.query(ImportReceipt).filter(ImportReceipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    if not r.is_debt:
        raise HTTPException(status_code=400, detail="Receipt is not a debt")
    
    r.is_debt = False
    db.commit()
    
    # Reload with items
    r_full = (
        db.query(ImportReceipt)
        .options(selectinload(ImportReceipt.items).selectinload(ImportItem.product))
        .filter(ImportReceipt.id == receipt_id)
        .first()
    )
    return _build_receipt_out(r_full)



def _build_receipt_out(r: ImportReceipt) -> dict:
    items = []
    for item in r.items:
        name = ""
        try:
            name = item.product.name
        except Exception:
            pass
        items.append({
            "id": item.id,
            "product_id": item.product_id,
            "batch_id": item.batch_id,
            "quantity": item.quantity,
            "import_price": item.import_price,
            "product_name": name,
        })
    return {
        "id": r.id,
        "date": r.date,
        "created_by": r.created_by,
        "supplier": r.supplier,
        "is_debt": r.is_debt,
        "total_amount": r.total_amount,
        "items": items,
    }
