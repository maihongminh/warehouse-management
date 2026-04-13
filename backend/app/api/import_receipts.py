from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import ImportReceipt
from app.schemas.import_receipt import ImportReceiptCreate, ImportReceiptOut
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
            lines=lines,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return (
        db.query(ImportReceipt)
        .options(selectinload(ImportReceipt.items))
        .filter(ImportReceipt.id == receipt.id)
        .first()
    )


@router.get("/{receipt_id}", response_model=ImportReceiptOut)
def get_receipt(receipt_id: int, db: Session = Depends(get_db)) -> ImportReceipt:
    r = db.query(ImportReceipt).options(selectinload(ImportReceipt.items)).filter(ImportReceipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receipt not found")
    return r
