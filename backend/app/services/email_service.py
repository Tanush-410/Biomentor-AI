"""Outbound transactional email delivery."""
import logging
import smtplib
from email.message import EmailMessage

from app.core import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool(
        settings.smtp_host
        and settings.smtp_username
        and settings.smtp_password
        and settings.smtp_from_email
    )


def send_password_reset_email(to_email: str, reset_link: str) -> bool:
    """Send a password reset email.

    Returns True if the message was handed off to the SMTP server
    successfully. When SMTP is not configured, the link is logged instead so
    the reset flow stays testable in local development without email
    credentials.
    """
    if not _smtp_configured():
        logger.warning("SMTP is not configured; password reset link for %s: %s", to_email, reset_link)
        return False

    message = EmailMessage()
    message["Subject"] = "Reset your VYDRA CORE password"
    message["From"] = f"{settings.smtp_from_name} <{settings.smtp_from_email}>"
    message["To"] = to_email
    message.set_content(
        "We received a request to reset your VYDRA CORE password.\n\n"
        f"Reset it here: {reset_link}\n\n"
        "This link expires in 30 minutes. If you did not request this, you can ignore this email."
    )
    message.add_alternative(
        f"""\
<html>
  <body style="font-family: Arial, sans-serif; color: #18181b;">
    <p>We received a request to reset your VYDRA CORE password.</p>
    <p>
      <a href="{reset_link}"
         style="background:#d9c25c;color:#18181b;padding:10px 20px;border-radius:8px;
                text-decoration:none;font-weight:bold;display:inline-block;">
        Reset your password
      </a>
    </p>
    <p>Or copy this link into your browser:<br>{reset_link}</p>
    <p style="color:#71717a;font-size:12px;">
      This link expires in 30 minutes. If you did not request this, you can ignore this email.
    </p>
  </body>
</html>
""",
        subtype="html",
    )

    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
            if settings.smtp_use_tls:
                server.starttls()
            server.login(settings.smtp_username, settings.smtp_password)
            server.send_message(message)
        return True
    except Exception:
        logger.exception("Failed to send password reset email to %s", to_email)
        return False
