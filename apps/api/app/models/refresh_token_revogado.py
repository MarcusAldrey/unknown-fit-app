from datetime import datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RefreshTokenRevogado(Base):
    __tablename__ = "refresh_tokens_revogados"

    jti: Mapped[str] = mapped_column(String(36), primary_key=True)
    revogado_em: Mapped[datetime] = mapped_column(DateTime, nullable=False)
