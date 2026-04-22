from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Batch, Sale, SaleItem, SaleStatus, SaleReturn, SaleReturnItem


def dashboard(db: Session, *, today: date | None = None) -> dict:
    d = today or date.today()

    revenue = (
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(Sale.status == SaleStatus.completed, Sale.date == d)
        .scalar()
    )
    revenue = Decimal(str(revenue or 0))

    # Trừ doanh thu trả hàng (Option 2: tính vào ngày trả hàng)
    returned_revenue = (
        db.query(func.coalesce(func.sum(SaleReturnItem.quantity * SaleItem.sale_price), 0))
        .join(SaleReturn, SaleReturnItem.return_id == SaleReturn.id)
        .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
        .filter(func.date(SaleReturn.created_at) == d)
        .scalar()
    )
    revenue -= Decimal(str(returned_revenue or 0))

    profit_row = (
        db.query(
            func.coalesce(
                func.sum(
                    (SaleItem.sale_price - SaleItem.import_price_snapshot) * SaleItem.quantity
                ),
                0,
            )
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(Sale.status == SaleStatus.completed, Sale.date == d)
        .scalar()
    )
    profit = Decimal(str(profit_row or 0))

    # Trừ lợi nhuận bị mất do trả hàng
    returned_profit = (
        db.query(
            func.coalesce(
                func.sum(
                    (SaleItem.sale_price - SaleItem.import_price_snapshot) * SaleReturnItem.quantity
                ),
                0,
            )
        )
        .join(SaleReturn, SaleReturnItem.return_id == SaleReturn.id)
        .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
        .filter(func.date(SaleReturn.created_at) == d)
        .scalar()
    )
    profit -= Decimal(str(returned_profit or 0))

    low_threshold = 10
    subq = (
        select(Batch.product_id, func.sum(Batch.quantity_remaining).label("tot"))
        .group_by(Batch.product_id)
        .subquery()
    )
    low_stock_count = (
        db.query(func.count())
        .select_from(subq)
        .filter(subq.c.tot < low_threshold)
        .scalar()
    ) or 0

    soon = d + timedelta(days=30)
    expiring_soon_count = (
        db.query(func.count(Batch.id))
        .filter(Batch.expiry_date <= soon, Batch.expiry_date >= d, Batch.quantity_remaining > 0)
        .scalar()
    ) or 0

    return {
        "revenue_today": revenue,
        "profit_today": profit,
        "low_stock_count": int(low_stock_count),
        "expiring_soon_count": int(expiring_soon_count),
    }


def period_summary(db: Session, date_from: date, date_to: date) -> dict:
    """Tổng doanh thu / lợi nhuận / số hóa đơn hoàn thành trong khoảng ngày (inclusive)."""
    revenue = (
        db.query(func.coalesce(func.sum(Sale.total_amount), 0))
        .filter(
            Sale.status == SaleStatus.completed,
            Sale.date >= date_from,
            Sale.date <= date_to,
        )
        .scalar()
    )
    revenue = Decimal(str(revenue or 0))

    # Trừ doanh thu trả hàng trong khoảng thời gian
    returned_revenue = (
        db.query(func.coalesce(func.sum(SaleReturnItem.quantity * SaleItem.sale_price), 0))
        .join(SaleReturn, SaleReturnItem.return_id == SaleReturn.id)
        .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
        .filter(
            func.date(SaleReturn.created_at) >= date_from,
            func.date(SaleReturn.created_at) <= date_to
        )
        .scalar()
    )
    revenue -= Decimal(str(returned_revenue or 0))

    profit_row = (
        db.query(
            func.coalesce(
                func.sum(
                    (SaleItem.sale_price - SaleItem.import_price_snapshot) * SaleItem.quantity
                ),
                0,
            )
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .filter(
            Sale.status == SaleStatus.completed,
            Sale.date >= date_from,
            Sale.date <= date_to,
        )
        .scalar()
    )
    profit = Decimal(str(profit_row or 0))

    # Trừ lợi nhuận bị mất do trả hàng trong khoảng thời gian
    returned_profit = (
        db.query(
            func.coalesce(
                func.sum(
                    (SaleItem.sale_price - SaleItem.import_price_snapshot) * SaleReturnItem.quantity
                ),
                0,
            )
        )
        .join(SaleReturn, SaleReturnItem.return_id == SaleReturn.id)
        .join(SaleItem, SaleReturnItem.sale_item_id == SaleItem.id)
        .filter(
            func.date(SaleReturn.created_at) >= date_from,
            func.date(SaleReturn.created_at) <= date_to
        )
        .scalar()
    )
    profit -= Decimal(str(returned_profit or 0))

    sale_count = (
        db.query(func.count(Sale.id))
        .filter(
            Sale.status == SaleStatus.completed,
            Sale.date >= date_from,
            Sale.date <= date_to,
        )
        .scalar()
    ) or 0

    return {
        "date_from": date_from,
        "date_to": date_to,
        "revenue": revenue,
        "profit": profit,
        "completed_sale_count": int(sale_count),
    }
