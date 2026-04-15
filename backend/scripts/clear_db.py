import sqlite3
from pathlib import Path

db_path = Path("app/data/app.db")

if db_path.exists():
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Get all table names
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    # Drop each table
    cursor.execute("PRAGMA foreign_keys = OFF;")
    for table_name in tables:
        if table_name[0] != 'sqlite_sequence':
            cursor.execute(f'DROP TABLE IF EXISTS "{table_name[0]}";')
            print(f"Dropped table: {table_name[0]}")
    
    conn.commit()
    conn.close()
    print("All tables dropped successfully.")
else:
    print("Database file not found.")
