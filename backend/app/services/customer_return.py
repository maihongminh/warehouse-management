from sqlalchemy.orm import Session

from app.models import Batch, InventoryChangeType, InventoryLog


def return_stock_to_batch(
    db: Session,
    *,
    batch_id: int,
    quantity: int,
    ref_id: int | None = None,
) -> Batch:
    if quantity <= 0:
        raise ValueError("quantity must be positive")
    batch = db.query(Batch).filter(Batch.id == batch_id).with_for_update().first()
    if not batch:
        raise ValueError("Batch not found")

    batch.quantity_remaining += quantity
    db.add(
        InventoryLog(
            product_id=batch.product_id,
            batch_id=batch.id,
            change_quantity=quantity,
            type=InventoryChangeType.return_,
            ref_id=ref_id,
        )
    )
    db.commit()
    db.refresh(batch)
    return batch
