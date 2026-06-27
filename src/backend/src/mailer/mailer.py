import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
import os
from jinja2 import Environment, FileSystemLoader, select_autoescape

TEMPLATE_DIR = os.path.join(os.path.dirname(__file__), "templates")
logger = logging.getLogger(__name__)

env = Environment(
    loader=FileSystemLoader(TEMPLATE_DIR),
    autoescape=select_autoescape(["html", "xml"]),
)


def send_match_email(to_email: str, student_name: str, project_title: str) -> bool:
    """Send an email to a student when they are accepted into a team."""

    smtp_server = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("EMAIL_PORT", "587"))
    smtp_user = os.getenv("EMAIL_USER")
    smtp_password = os.getenv("EMAIL_PASSWORD")
    from_email = os.getenv("FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        logger.info("Email not configured. Missing EMAIL_USER or EMAIL_PASSWORD.")
        return False

    subject = "You have been matched with a WatMatch project"
    try:
        template = env.get_template("matched_email.html")
    except Exception as e:
        logger.warning("Failed to load email template: %s", e)
        return False

    body = template.render(
        student_name=student_name or "there",
        project_title=project_title or "a WatMatch capstone project",
    )

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))


    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        logger.info("Match email sent to %s", to_email)
        return True
    except Exception as e:
        logger.warning("Failed to send email: %s", e)
        return False


def send_capstone_approval_email(to_email: str, project_title: str) -> bool:
    """Send an email to a student when their capstone project is approved."""
    return _send_email(
        to_email,
        "Your Capstone Project has been Approved",
        "approved_email.html",
        project_title=project_title
    )


def send_capstone_rejection_email(to_email: str, project_title: str) -> bool:
    """Send an email to a student when their capstone project is rejected."""
    return _send_email(
        to_email,
        "Update on your Capstone Project Proposal",
        "rejected_email.html",
        project_title=project_title
    )


def send_capstone_changes_email(to_email: str, project_title: str, comments: str) -> bool:
    """Send an email to a student when changes are requested for their capstone project."""
    return _send_email(
        to_email,
        "Changes Requested for your Capstone Project",
        "changes_email.html",
        project_title=project_title,
        comments=comments
    )


def send_interest_rejected_email(to_email: str, project_title: str) -> bool:
    """Send an email to a student when their interest in a project is rejected."""
    return _send_email(
        to_email,
        "Update on your Interest Application",
        "interest_rejected_email.html",
        project_title=project_title
    )


def _send_email(to_email: str, subject: str, template_name: str, **kwargs) -> bool:
    """Helper function to send emails using templates."""
    smtp_server = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("EMAIL_PORT", "587"))
    smtp_user = os.getenv("EMAIL_USER")
    smtp_password = os.getenv("EMAIL_PASSWORD")
    from_email = os.getenv("FROM_EMAIL", smtp_user)

    if not smtp_user or not smtp_password:
        logger.info("Email not configured. Missing EMAIL_USER or EMAIL_PASSWORD.")
        return False

    try:
        template = env.get_template(template_name)
    except Exception as e:
        logger.warning("Failed to load email template %s: %s", template_name, e)
        return False

    body = template.render(**kwargs)

    msg = MIMEMultipart()
    msg["From"] = from_email
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    try:
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.sendmail(from_email, [to_email], msg.as_string())
        logger.info("Email sent to %s (Subject: %s)", to_email, subject)
        return True
    except Exception as e:
        logger.warning("Failed to send email: %s", e)
        return False
