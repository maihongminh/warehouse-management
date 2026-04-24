from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models import Product, Sale, SaleItem, SaleReturn, SaleReturnItem, SaleStatus
from app.schemas.sale import SaleCompleteOut, SaleCreate, SaleOut, SaleWithItemsOut
from app.schemas.sale_return import SaleReturnCreate, SaleReturnOut
from app.schemas.pagination import PaginatedResponse
from app.services import sale as sale_svc
from app.services import sale_return as return_svc

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
    product_name: str | None = Query(None, description="Tìm theo tên sản phẩm trong hóa đơn"),
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
    if product_name:
        # JOIN SaleItem → Product, lọc theo tên SP, distinct để tránh trùng
        q = q.join(SaleItem, SaleItem.sale_id == Sale.id)\
             .join(Product, Product.id == SaleItem.product_id)\
             .filter(Product.name.ilike(f"%{product_name}%"))\
             .distinct()

    total = q.count()
    total_pages = (total + size - 1) // size
    sales = q.order_by(Sale.id.desc()).offset((page - 1) * size).limit(size).all()

    # Tính returned_amount cho từng sale trong trang
    sale_ids = [s.id for s in sales]
    returned_map: dict[int, float] = {}
    if sale_ids:
        rows = (
            db.query(SaleReturn.sale_id, func.sum(SaleReturnItem.quantity * SaleItem.sale_price))
            .join(SaleReturnItem, SaleReturnItem.return_id == SaleReturn.id)
            .join(SaleItem, SaleItem.id == SaleReturnItem.sale_item_id)
            .filter(SaleReturn.sale_id.in_(sale_ids))
            .group_by(SaleReturn.sale_id)
            .all()
        )
        returned_map = {sale_id: float(amt or 0) for sale_id, amt in rows}

    items_out = []
    for s in sales:
        items_out.append({
            "id": s.id,
            "date": s.date,
            "total_amount": s.total_amount,
            "returned_amount": returned_map.get(s.id, 0),
            "status": s.status,
            "created_by": s.created_by,
        })

    return {
        "items": items_out,
        "total": total,
        "page": page,
        "size": size,
        "total_pages": total_pages,
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


@router.post("/{sale_id}/return", response_model=SaleReturnOut, status_code=201)
def return_sale_items(
    sale_id: int,
    body: SaleReturnCreate,
    db: Session = Depends(get_db),
) -> dict:
    """Tạo phiếu trả hàng cho hóa đơn đã hoàn tất."""
    lines = [li.model_dump() for li in body.items]
    try:
        result = return_svc.create_sale_return(
            db,
            sale_id=sale_id,
            lines=lines,
            note=body.note,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    # Build output manually since product name lives in relationship
    items_out = []
    for ri in result.items:
        product_name = ""
        try:
            product_name = ri.product.name if ri.product else ""
        except Exception:
            pass
        items_out.append({
            "id": ri.id,
            "sale_item_id": ri.sale_item_id,
            "batch_id": ri.batch_id,
            "product_id": ri.product_id,
            "quantity": ri.quantity,
            "product_name": product_name,
        })
    return {
        "id": result.id,
        "sale_id": result.sale_id,
        "note": result.note,
        "created_at": result.created_at,
        "items": items_out,
    }


@router.get("/{sale_id}/returns", response_model=list[SaleReturnOut])
def list_sale_returns(sale_id: int, db: Session = Depends(get_db)) -> list:
    """Lấy danh sách phiếu trả hàng của một hóa đơn."""
    returns = return_svc.get_returns_for_sale(db, sale_id)
    result = []
    for ret in returns:
        items_out = []
        for ri in ret.items:
            product_name = ""
            try:
                product_name = ri.product.name if ri.product else ""
            except Exception:
                pass
            items_out.append({
                "id": ri.id,
                "sale_item_id": ri.sale_item_id,
                "batch_id": ri.batch_id,
                "product_id": ri.product_id,
                "quantity": ri.quantity,
                "product_name": product_name,
            })
        result.append({
            "id": ret.id,
            "sale_id": ret.sale_id,
            "note": ret.note,
            "created_at": ret.created_at,
            "items": items_out,
        })
    return result
