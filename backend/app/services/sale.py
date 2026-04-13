from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session, selectinload

from app.models import (
    Batch,
    InventoryChangeType,
    InventoryLog,
    Product,
    Sale,
    SaleItem,
    SaleStatus,
)


def complete_sale_fefo(db: Session, sale_id: int, *, sale_date: date | None = None) -> Sale:
    sale = (
        db.query(Sale)
        .options(selectinload(Sale.items))
        .filter(Sale.id == sale_id)
        .with_for_update()
        .first()
    )
    if not sale:
        raise ValueError("Sale not found")
    if sale.status != SaleStatus.draft:
        raise ValueError("Sale is not draft")

    draft_items = list(sale.items)
    if not draft_items:
        raise ValueError("No line items")

    today = sale_date or date.today()

    allocations: list[dict] = []
    for line in draft_items:
        qty_needed = line.quantity
        product = db.get(Product, line.product_id)
        if not product:
            raise ValueError(f"Product {line.product_id} not found")

        batches = (
            db.query(Batch)
            .filter(
                Batch.product_id == line.product_id,
                Batch.quantity_remaining > 0,
                Batch.expiry_date >= today,
            )
            .order_by(Batch.expiry_date.asc(), Batch.id.asc())
            .with_for_update()
            .all()
        )

        available = sum(b.quantity_remaining for b in batches)
        if available < qty_needed:
            raise ValueError(
                f"Insufficient stock for product {product.name} (sku {product.sku}): "
                f"need {qty_needed}, have {available}"
            )

        for b in batches:
            if qty_needed <= 0:
                break
            take = min(b.quantity_remaining, qty_needed)
            allocations.append(
                {
                    "product_id": line.product_id,
                    "batch_id": b.id,
                    "quantity": take,
                    "sale_price": line.sale_price,
                    "import_price_snapshot": b.import_price,
                }
            )
            b.quantity_remaining -= take
            qty_needed -= take

        if qty_needed > 0:
            raise ValueError(f"Allocation failed for product {line.product_id}")

    for item in draft_items:
        db.delete(item)
    db.flush()

    total = Decimal("0")
    for row in allocations:
        sp = Decimal(str(row["sale_price"]))
        qty = row["quantity"]
        total += sp * qty
        db.add(
            SaleItem(
                sale_id=sale.id,
                product_id=row["product_id"],
                batch_id=row["batch_id"],
                quantity=qty,
                sale_price=row["sale_price"],
                import_price_snapshot=row["import_price_snapshot"],
            )
        )
        db.add(
            InventoryLog(
                product_id=row["product_id"],
                batch_id=row["batch_id"],
                change_quantity=-qty,
                type=InventoryChangeType.sale,
                ref_id=sale.id,
            )
        )

    sale.total_amount = total
    sale.status = SaleStatus.completed
    db.commit()
    db.refresh(sale)
    return sale


def cancel_sale(db: Session, sale_id: int) -> Sale:
    sale = db.query(Sale).filter(Sale.id == sale_id).with_for_update().first()
    if not sale:
        raise ValueError("Sale not found")
    if sale.status != SaleStatus.draft:
        raise ValueError("Only draft sales can be cancelled")
    sale.status = SaleStatus.cancelled
    db.commit()
    db.refresh(sale)
    return sale
