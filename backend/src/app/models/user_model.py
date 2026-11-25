from sqlalchemy import String, Uuid
import uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database.db_base import Base

class GithubUser(Base):
    __tablename__ = "github_users"

    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
    clerk_user_id: Mapped[str] = mapped_column(unique=True)
    username: Mapped[str] = mapped_column(String(100))
