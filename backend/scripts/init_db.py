from app.db.session import engine
from app.models import Base

def init_db():
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database initialized successfully.")

if __name__ == "__main__":
    init_db()
