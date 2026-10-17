"""Transactional email via SMTP. In development with no SMTP configured, the message is logged
(including links) so flows can be exercised locally. In production, missing SMTP is an error."""
import logging
import smtplib
from email.message import EmailMessage

from ..config import get_settings

log = logging.getLogger("truthlens.email")


def send_email(to: str, subject: str, body: str) -> bool:
    s = get_settings()
    if not s.smtp_host:
        if s.env == "production":
            log.error("SMTP not configured; email to %s not sent", to)
            return False
        log.warning("DEV EMAIL (not sent) to=%s subject=%s\n%s", to, subject, body)
        return True
    msg = EmailMessage()
    msg["From"], msg["To"], msg["Subject"] = s.mail_from, to, subject
    msg.set_content(body)
    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=15) as smtp:
            smtp.starttls()
            if s.smtp_user:
                smtp.login(s.smtp_user, s.smtp_password)
            smtp.send_message(msg)
        return True
    except Exception:  # noqa: BLE001 - never leak SMTP details to the client
        log.exception("Failed to send email")
        return False
