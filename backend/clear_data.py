import sqlite3

db_path = r"app\data\app.db"
conn = sqlite3.connect(db_path)
cur = conn.cursor()

tables_to_clear = [
    "batches",
    "import_items",
    "import_receipts",
    "inventory_logs",
    "sale_items",
    "sale_return_items",
    "sale_returns",
    "sales",
    "stock_adjustments"
]

for t in tables_to_clear:
    cur.execute(f"DELETE FROM {t};")
    try:
        cur.execute(f"DELETE FROM sqlite_sequence WHERE name='{t}';")
    except sqlite3.OperationalError:
        pass

conn.commit()
conn.close()
print("Cleared successfully.")
