"""Service xử lý trả hàng từ hóa đơn đã hoàn tất."""
from sqlalchemy.orm import Session, selectinload

from app.models import (
    Batch,
    InventoryChangeType,
    InventoryLog,
    SaleItem,
    SaleReturn,
    SaleReturnItem,
    SaleStatus,
    Sale,
)


def create_sale_return(
    db: Session,
    sale_id: int,
    lines: list[dict],  # [{sale_item_id, quantity}]
    note: str | None = None,
) -> SaleReturn:
    """
    Tạo phiếu trả hàng cho hóa đơn `sale_id`.
    Mỗi dòng gồm: sale_item_id, quantity (≤ qty chưa trả).
    Hoàn lại kho vào batch tương ứng của sale_item.
    """
    # Validate hóa đơn tồn tại và đã hoàn tất
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise ValueError(f"Không tìm thấy hóa đơn #{sale_id}")
    if sale.status != SaleStatus.completed:
        raise ValueError("Chỉ có thể trả hàng cho hóa đơn đã hoàn tất.")

    # Load tất cả returns đã có để tính qty đã trả
    existing_returns = (
        db.query(SaleReturnItem)
        .join(SaleReturn)
        .filter(SaleReturn.sale_id == sale_id)
        .all()
    )
    returned_by_item: dict[int, int] = {}
    for ri in existing_returns:
        returned_by_item[ri.sale_item_id] = returned_by_item.get(ri.sale_item_id, 0) + ri.quantity

    # Create return receipt
    sale_return = SaleReturn(sale_id=sale_id, note=note)
    db.add(sale_return)
    db.flush()

    return_items = []
    for line in lines:
        item_id = line["sale_item_id"]
        qty_return = line["quantity"]

        sale_item = db.query(SaleItem).filter(SaleItem.id == item_id, SaleItem.sale_id == sale_id).first()
        if not sale_item:
            raise ValueError(f"Dòng #{item_id} không thuộc hóa đơn này.")
        if sale_item.batch_id is None:
            raise ValueError(f"Dòng #{item_id} không có thông tin lô — không thể trả kho.")

        already_returned = returned_by_item.get(item_id, 0)
        can_return = sale_item.quantity - already_returned
        if qty_return > can_return:
            raise ValueError(
                f"Số lượng trả ({qty_return}) vượt quá số lượng có thể trả ({can_return}) "
                f"cho dòng #{item_id}."
            )

        # Hoàn lại tồn kho
        batch = db.query(Batch).filter(Batch.id == sale_item.batch_id).with_for_update().first()
        if not batch:
            raise ValueError(f"Không tìm thấy lô #{sale_item.batch_id}")
        batch.quantity_remaining += qty_return

        # Ghi log kho
        db.add(
            InventoryLog(
                product_id=sale_item.product_id,
                batch_id=sale_item.batch_id,
                change_quantity=qty_return,
                type=InventoryChangeType.return_,
                ref_id=sale_return.id,
            )
        )

        ri = SaleReturnItem(
            return_id=sale_return.id,
            sale_item_id=item_id,
            batch_id=sale_item.batch_id,
            product_id=sale_item.product_id,
            quantity=qty_return,
        )
        db.add(ri)
        return_items.append(ri)

    db.commit()

    # Reload với relationship
    result = (
        db.query(SaleReturn)
        .options(selectinload(SaleReturn.items).selectinload(SaleReturnItem.product))
        .filter(SaleReturn.id == sale_return.id)
        .first()
    )
    return result


def get_returns_for_sale(db: Session, sale_id: int) -> list[SaleReturn]:
    """Lấy tất cả phiếu trả hàng của một hóa đơn."""
    return (
        db.query(SaleReturn)
        .options(selectinload(SaleReturn.items).selectinload(SaleReturnItem.product))
        .filter(SaleReturn.sale_id == sale_id)
        .order_by(SaleReturn.id.desc())
        .all()
    )
