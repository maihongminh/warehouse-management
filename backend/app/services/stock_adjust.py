from sqlalchemy.orm import Session

from app.models import Batch, InventoryChangeType, InventoryLog, StockAdjustment


def apply_stock_take(db: Session, batch_id: int, actual_quantity: int) -> StockAdjustment:
    batch = db.query(Batch).filter(Batch.id == batch_id).with_for_update().first()
    if not batch:
        raise ValueError("Không tìm thấy lô hàng")

    system_qty = batch.quantity_remaining
    diff = actual_quantity - system_qty
    batch.quantity_remaining = actual_quantity

    adj = StockAdjustment(
        batch_id=batch.id,
        system_quantity=system_qty,
        actual_quantity=actual_quantity,
        difference=diff,
    )
    db.add(adj)
    db.flush()

    if diff != 0:
        db.add(
            InventoryLog(
                product_id=batch.product_id,
                batch_id=batch.id,
                change_quantity=diff,
                type=InventoryChangeType.adjust,
                ref_id=adj.id,
            )
        )

    db.commit()
    db.refresh(adj)
    return adj
