"""Email transport. Local messages are private files, never public API responses."""
import os
import ssl
import smtplib
import uuid
from pathlib import Path
from email.message import EmailMessage
from app.core.config import get_settings


def send_email(recipient: str, subject: str, body: str):
    settings = get_settings()
    message = EmailMessage()
    message['From'] = settings.email_from
    message['To'] = recipient
    message['Subject'] = subject
    message.set_content(body)
    if settings.email_backend == 'file':
        if settings.app_env == 'production':
            raise RuntimeError('Transport fichier interdit en production')
        directory = Path(settings.email_outbox_dir)
        if directory.is_symlink():
            raise RuntimeError('Répertoire de courrier invalide')
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        directory.chmod(0o700)
        path = directory / (uuid.uuid4().hex + '.eml')
        with open(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'wb') as output:
            output.write(message.as_bytes())
        return
    if settings.email_backend != 'smtp':
        raise RuntimeError('Email désactivé')
    context = ssl.create_default_context()
    if settings.smtp_port == 465:
        client = smtplib.SMTP_SSL(settings.smtp_host, settings.smtp_port, timeout=10, context=context)
    else:
        client = smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10)
    with client:
        if settings.smtp_port != 465:
            client.starttls(context=context)
        if settings.smtp_username:
            client.login(settings.smtp_username, settings.smtp_password)
        client.send_message(message)
