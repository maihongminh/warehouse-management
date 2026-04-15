from datetime import date, datetime
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload
import openpyxl

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
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập")
    return _build_receipt_out(r)

@router.patch("/{receipt_id}/pay", response_model=ImportReceiptOut)
def pay_debt(receipt_id: int, db: Session = Depends(get_db)) -> dict:
    r = db.query(ImportReceipt).filter(ImportReceipt.id == receipt_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiếu nhập")
    if not r.is_debt:
        raise HTTPException(status_code=400, detail="Phiếu nhập này không phải là phiếu ghi nợ")
    
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

@router.post("/parse-excel")
def parse_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename or not file.filename.endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Chỉ chấp nhận file .xlsx")

    try:
        content = file.file.read()
        wb = openpyxl.load_workbook(BytesIO(content), data_only=True)
        ws = wb.active
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Không đọc được file Excel: {e}") from e

    lines = []
    errors = []

    for row_idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
        if not row or row[0] is None:
            continue
        try:
            sku = str(row[0]).strip()
            if not sku:
                continue

            # Find product
            product = db.query(Product).filter(Product.sku == sku).first()
            if not product:
                errors.append(f"Dòng {row_idx}: Không tìm thấy sản phẩm có mã SKU '{sku}'")
                continue

            # Parse quantity (col 5 is index 4) — làm tròn số thập phân thành số nguyên
            qty_raw = row[4]
            qty_val = 0
            if qty_raw is not None and str(qty_raw).strip() != "":
                qty_val = round(float(qty_raw))

            # Bỏ qua dòng tồn kho = 0 (không cần nhập kho)
            if qty_val <= 0:
                continue

            # Import price (col 4 is index 3)
            imp_price_raw = row[3]
            if imp_price_raw is not None and str(imp_price_raw).strip() != "":
                imp_price = float(imp_price_raw)
            else:
                imp_price = product.default_import_price if product.default_import_price else 0

            # Batch (col 8 is index 7)
            batch = ""
            if len(row) > 7 and row[7]:
                batch = str(row[7]).strip()

            # Expiry (col 9 is index 8)
            expiry_str = ""
            if len(row) > 8 and row[8]:
                raw_exp = row[8]
                try:
                    # openpyxl reads date cells as datetime objects directly
                    import datetime as dt_module
                    if isinstance(raw_exp, (dt_module.datetime, dt_module.date)):
                        expiry_str = raw_exp.strftime("%Y-%m-%d")
                    else:
                        raw_str = str(raw_exp).strip()
                        # Try dd/mm/yyyy
                        try:
                            expiry_str = datetime.strptime(raw_str.split(" ")[0], "%d/%m/%Y").strftime("%Y-%m-%d")
                        except ValueError:
                            # Try yyyy-mm-dd
                            expiry_str = datetime.strptime(raw_str.split(" ")[0], "%Y-%m-%d").strftime("%Y-%m-%d")
                except Exception:
                    expiry_str = str(raw_exp)

            lines.append({
                "product_id": product.id,
                "product_summary": f"{product.name} · {product.sku}",
                "quantity": str(qty_val),  # gửi dạng int string
                "import_price": str(imp_price),
                "batch_code": batch,
                "expiry_date": expiry_str
            })

        except Exception as e:
            errors.append(f"Dòng {row_idx}: {e}")

    return {
        "lines": lines,
        "errors": errors
    }
