"""Utilidad para envío de emails (SMTP)."""
import logging
import smtplib
import ssl
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def _nombre_optica() -> str:
    """Nombre comercial configurado en el sistema (Configuración → nombre_optica)."""
    try:
        from sqlalchemy import select
        from app.core.db import SessionLocal
        from app.models.configuracion import Configuracion
        with SessionLocal() as db:
            row = db.execute(
                select(Configuracion).where(Configuracion.clave == "nombre_optica")
            ).scalar_one_or_none()
            return (row.valor if row and row.valor else "Óptica")
    except Exception:
        return "Óptica"


def send_email(to_email: str, subject: str, html_body: str, text_body: str = "") -> bool:
    """Envía un email. Retorna True si tuvo éxito."""
    from app.core.config import settings

    if not all([settings.SMTP_HOST, settings.SMTP_USER, settings.SMTP_PASS]):
        logger.warning("SMTP no configurado — email no enviado (%s)", subject)
        return False

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = f"{_nombre_optica()} <{settings.SMTP_USER}>"
        msg["To"]      = to_email

        if text_body:
            msg.attach(MIMEText(text_body, "plain", "utf-8"))
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        ctx = ssl.create_default_context()

        if settings.SMTP_PORT == 465:
            with smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, context=ctx) as server:
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.sendmail(settings.SMTP_USER, to_email, msg.as_string())
        else:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20) as server:
                server.ehlo()
                server.starttls(context=ctx)
                server.login(settings.SMTP_USER, settings.SMTP_PASS)
                server.sendmail(settings.SMTP_USER, to_email, msg.as_string())

        logger.info("Email enviado a %s: %s", to_email, subject)
        return True
    except Exception as exc:
        logger.error("Error enviando email a %s: %s", to_email, exc)
        return False
