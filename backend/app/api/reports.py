from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models import Sale, SaleItem, SaleStatus, SaleReturn, SaleReturnItem, Product
from app.schemas.report import DashboardOut, PeriodSummaryOut
from app.services import reports as reports_svc

router = APIRouter()


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(db=Depends(get_db), on_date: date | None = Query(None, alias="date")):
    data = reports_svc.dashboard(db, today=on_date)
    return data


@router.get("/period", response_model=PeriodSummaryOut)
def period_summary(
    db=Depends(get_db),
    date_from: date = Query(..., description="Từ ngày (inclusive)"),
    date_to: date = Query(..., description="Đến ngày (inclusive)"),
):
    if date_from > date_to:
        raise HTTPException(status_code=400, detail="Từ ngày không được lớn hơn Đến ngày")
    return reports_svc.period_summary(db, date_from, date_to)


@router.get("/revenue-daily")
def revenue_daily(
    db: Session = Depends(get_db),
    days: int = Query(7, ge=1, le=90),
):
    """Doanh thu + lợi nhuận thuần theo từng ngày (đã trừ trả hàng), dùng cho biểu đồ."""
    today = date.today()
    result = []
    for i in range(days - 1, -1, -1):
        d = today - timedelta(days=i)
        rev = (
            db.query(func.coalesce(func.sum(Sale.total_amount), 0))
            .filter(Sale.status == SaleStatus.completed, Sale.date == d)
            .scalar()
        )
        rev = float(rev or 0)

        # Lợi nhuận
        profit_row = (
            db.query(func.coalesce(
                func.sum((SaleItem.sale_price - SaleItem.import_price_snapshot) * SaleItem.quantity), 0
            ))
            .join(Sale, SaleItem.sale_id == Sale.id)
            .filter(Sale.status == SaleStatus.completed, Sale.date == d)
            .scalar()
        )
        profit = float(profit_row or 0)

        # Trừ trả hàng (doanh thu)
        ret = (
            db.query(func.coalesce(func.sum(SaleReturnItem.quantity * SaleItem.sale_price), 0))
            .join(SaleReturn, SaleReturnItem.return_id == SaleReturn.id)
            .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
            .filter(func.date(SaleReturn.created_at) == d)
            .scalar()
        )
        rev -= float(ret or 0)

        # Trừ trả hàng (lợi nhuận)
        ret_profit = (
            db.query(func.coalesce(
                func.sum((SaleItem.sale_price - SaleItem.import_price_snapshot) * SaleReturnItem.quantity), 0
            ))
            .join(SaleReturn, SaleReturnItem.return_id == SaleReturn.id)
            .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
            .filter(func.date(SaleReturn.created_at) == d)
            .scalar()
        )
        profit -= float(ret_profit or 0)

        result.append({"date": d.isoformat(), "revenue": round(rev, 3), "profit": round(profit, 3)})
    return result


@router.get("/top-products")
def top_products(
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=365),
    limit: int = Query(6, ge=1, le=20),
):
    """Top sản phẩm bán chạy nhất (theo số lượng) trong N ngày gần nhất."""
    since = date.today() - timedelta(days=days)
    rows = (
        db.query(
            Product.name,
            func.sum(SaleItem.quantity).label("total_qty"),
        )
        .join(SaleItem, SaleItem.product_id == Product.id)
        .join(Sale, Sale.id == SaleItem.sale_id)
        .filter(Sale.status == SaleStatus.completed, Sale.date >= since)
        .group_by(Product.id, Product.name)
        .order_by(func.sum(SaleItem.quantity).desc())
        .limit(limit)
        .all()
    )
    return [{"name": name, "quantity": int(qty)} for name, qty in rows]
