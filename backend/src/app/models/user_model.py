from sqlalchemy import String, Uuid
import uuid
from sqlalchemy.orm import Mapped, mapped_column

from src.app.database.db_base import Base

class GithubUser(Base):
    __tablename__ = "github_users"

    id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4())
    email:Mapped[str]=mapped_column(String=255, unique=True, nullable=False, index=True)
    targeted_role: Mapped[str | None]=mapped_column(nullable=True)
    experience: Mapped[str | None]=mapped_column(nullable=True)