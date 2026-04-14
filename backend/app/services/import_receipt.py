from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models import Batch, ImportItem, ImportReceipt, InventoryChangeType, InventoryLog, Product


def create_import_receipt(
    db: Session,
    *,
    receipt_date: date,
    created_by: str,
    supplier: str | None = None,
    is_debt: bool = False,
    lines: list[dict],
) -> ImportReceipt:
    receipt = ImportReceipt(
        date=receipt_date,
        created_by=created_by,
        supplier=supplier,
        is_debt=is_debt,
        total_amount=Decimal("0"),
    )
    db.add(receipt)
    db.flush()

    running_total = Decimal("0")

    for line in lines:
        product = db.get(Product, line["product_id"])
        if not product or not product.is_active:
            raise ValueError(f"Product {line['product_id']} not found or inactive")

        batch_code = line.get("batch_code") or ""
        expiry_date = line["expiry_date"]
        qty = int(line["quantity"])
        import_price = Decimal(str(line["import_price"]))

        batch = (
            db.query(Batch)
            .filter(
                Batch.product_id == product.id,
                Batch.batch_code == batch_code,
                Batch.expiry_date == expiry_date,
            )
            .first()
        )
        if batch:
            batch.quantity_remaining += qty
            batch.import_price = import_price
        else:
            batch = Batch(
                product_id=product.id,
                batch_code=batch_code,
                expiry_date=expiry_date,
                import_price=import_price,
                quantity_remaining=qty,
            )
            db.add(batch)
            db.flush()

        item = ImportItem(
            receipt_id=receipt.id,
            product_id=product.id,
            batch_id=batch.id,
            quantity=qty,
            import_price=import_price,
        )
        db.add(item)

        running_total += import_price * qty

        db.add(
            InventoryLog(
                product_id=product.id,
                batch_id=batch.id,
                change_quantity=qty,
                type=InventoryChangeType.import_,
                ref_id=receipt.id,
            )
        )

    receipt.total_amount = running_total
    db.commit()
    db.refresh(receipt)
    return receipt
