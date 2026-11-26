
from sqlalchemy.orm import Mapped, mapped_column
from datetime import datetime
import uuid
from sqlalchemy import DateTime, Text, ForeignKey, func
from app.database.db_base import Base
from sqlalchemy import DateTime

class Assessment(Base):
    __tablename__ = "github_assessment"

    report: Mapped[str]=mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
    )
    clerk_user_id: Mapped[str] = mapped_column(
        ForeignKey("github_users.clerk_user_id"),
        primary_key=True,
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        index=True
    )
