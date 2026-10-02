import datetime as dt
from sqlalchemy import String, Integer, ForeignKey, DateTime, Text, Index, Numeric, Boolean, Float, LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .db import Base

now = lambda: dt.datetime.now(dt.timezone.utc)

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    full_name: Mapped[str] = mapped_column(String(120), default="")
    password_hash: Mapped[str] = mapped_column(String(100))
    role: Mapped[str] = mapped_column(String(20))  # ADMIN|JEFE|SUPERVISOR|TECNICO|CONSULTA
    technician_id: Mapped[int | None] = mapped_column(ForeignKey("technicians.id"), unique=True)
    technician = relationship("Technician")

class FloorPlan(Base):
    __tablename__ = "floor_plans"
    id: Mapped[int] = mapped_column(primary_key=True)
    filename: Mapped[str] = mapped_column(String(255))
    pdf_data: Mapped[bytes] = mapped_column(LargeBinary)
    image_data: Mapped[bytes] = mapped_column(LargeBinary)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

class Technician(Base):
    __tablename__ = "technicians"
    id: Mapped[int] = mapped_column(primary_key=True)
    first_name: Mapped[str] = mapped_column(String(80))
    last_name: Mapped[str] = mapped_column(String(80))
    position: Mapped[str | None] = mapped_column(String(80))
    username: Mapped[str | None] = mapped_column(String(50), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="ACTIVO", index=True)
    shift: Mapped[str | None] = mapped_column(String(20))
    contracted_hours: Mapped[int | None] = mapped_column(Integer)
    specialties: Mapped[str | None] = mapped_column(Text)
    hire_date: Mapped[dt.date | None] = mapped_column()
    notes: Mapped[str | None] = mapped_column(Text)

class Part(Base):
    __tablename__ = "parts"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160), index=True)
    category: Mapped[str | None] = mapped_column(String(80))
    brand: Mapped[str | None] = mapped_column(String(80))
    model: Mapped[str | None] = mapped_column(String(80))
    stock: Mapped[int] = mapped_column(Integer, default=0)
    minimum_stock: Mapped[int] = mapped_column(Integer, default=0)
    location: Mapped[str | None] = mapped_column(String(120))
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    supplier: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(20), default="ACTIVO", index=True)
    inventory_type: Mapped[str] = mapped_column(String(20), default="REPUESTO", index=True)

class PartMovement(Base):
    __tablename__ = "part_movements"
    id: Mapped[int] = mapped_column(primary_key=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.id"), index=True)
    movement_type: Mapped[str] = mapped_column(String(20))
    quantity: Mapped[int] = mapped_column(Integer)
    stock_after: Mapped[int] = mapped_column(Integer)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"), index=True)
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"), index=True)
    technician: Mapped[str | None] = mapped_column(String(120))
    notes: Mapped[str | None] = mapped_column(Text)
    part = relationship("Part")

class Area(Base):
    __tablename__ = "areas"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60), unique=True)

class Island(Base):
    __tablename__ = "islands"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(10), unique=True)
    hall: Mapped[str | None] = mapped_column(String(60))

class Machine(Base):
    __tablename__ = "machines"
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)
    island_id: Mapped[int | None] = mapped_column(ForeignKey("islands.id"))
    area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id"))
    manufacturer: Mapped[str | None] = mapped_column(String(80))  # NULL = desconocido
    model: Mapped[str | None] = mapped_column(String(80))
    serial: Mapped[str | None] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(30), default="OPERATIVA", index=True)
    position_x: Mapped[float | None] = mapped_column(Float)
    position_y: Mapped[float | None] = mapped_column(Float)
    island = relationship("Island")
    area = relationship("Area")

class MachineStatusHistory(Base):
    """Append-only: nunca se actualiza el estado anterior, salvo cerrar el downtime."""
    __tablename__ = "machine_status_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"), index=True)
    old_status: Mapped[str] = mapped_column(String(30))
    new_status: Mapped[str] = mapped_column(String(30))
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str] = mapped_column(Text)
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"))
    downtime_end: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True))
    downtime_minutes: Mapped[int | None] = mapped_column(Integer)

class Ticket(Base):
    __tablename__ = "tickets"
    id: Mapped[int] = mapped_column(primary_key=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id"))
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"), index=True)
    task: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text, default="")
    technician: Mapped[str | None] = mapped_column(String(120))
    shift: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(30), default="NUEVO", index=True)
    priority: Mapped[str] = mapped_column(String(10), default="NORMAL")
    sla_due_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    sla_overdue_notified_at: Mapped[dt.datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    jira_number: Mapped[str | None] = mapped_column(String(30))
    result: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    machine = relationship("Machine")
    area = relationship("Area")
    requester = relationship("User", foreign_keys=[created_by])
    attachments = relationship("TicketAttachment", order_by="TicketAttachment.id", cascade="all, delete-orphan")

class TicketStatusHistory(Base):
    __tablename__ = "ticket_status_history"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), index=True)
    old_status: Mapped[str] = mapped_column(String(30), default="")
    new_status: Mapped[str] = mapped_column(String(30))
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str | None] = mapped_column(Text)

class TicketComment(Base):
    __tablename__ = "ticket_comments"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    body: Mapped[str] = mapped_column(Text)
    user = relationship("User")

class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"
    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_id: Mapped[int] = mapped_column(ForeignKey("tickets.id"), index=True)
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(80))
    image_data: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    ticket = relationship("Ticket")

class Intervention(Base):
    __tablename__ = "interventions"
    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now, index=True)
    ticket_id: Mapped[int | None] = mapped_column(ForeignKey("tickets.id"), index=True)
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"), index=True)
    area_id: Mapped[int | None] = mapped_column(ForeignKey("areas.id"))
    technician: Mapped[str | None] = mapped_column(String(120))
    shift: Mapped[str | None] = mapped_column(String(20))
    work_type: Mapped[str | None] = mapped_column(String(80))
    task: Mapped[str] = mapped_column(String(200))
    detail: Mapped[str] = mapped_column(Text, default="")
    island: Mapped[str] = mapped_column(String(64), default="")
    jira_number: Mapped[str] = mapped_column(String(64), default="")
    pending: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    result: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    machine = relationship("Machine")
    area = relationship("Area")

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    entity: Mapped[str] = mapped_column(String(60))
    old_value: Mapped[str | None] = mapped_column(Text)
    new_value: Mapped[str | None] = mapped_column(Text)

class EmailSettings(Base):
    __tablename__ = "email_settings"
    id: Mapped[int] = mapped_column(primary_key=True)
    smtp_host: Mapped[str | None] = mapped_column(String(255))
    smtp_port: Mapped[int] = mapped_column(Integer, default=587)
    smtp_user: Mapped[str | None] = mapped_column(String(255))
    smtp_password_encrypted: Mapped[str | None] = mapped_column(Text)
    smtp_from: Mapped[str | None] = mapped_column(String(255))
    smtp_from_name: Mapped[str] = mapped_column(String(120), default="Gestión Técnica")
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
    notification_email_to: Mapped[str] = mapped_column(Text, default="")
    report_email_to: Mapped[str] = mapped_column(Text, default="")
    report_email_cc: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=now, onupdate=now)
    updated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
