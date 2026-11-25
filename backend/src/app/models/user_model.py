from sqlalchemy import String, Uuid
import uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database.db_base import Base

class GithubUser(Base):
    __tablename__ = "github_users"

    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
