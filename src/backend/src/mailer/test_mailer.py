import os
from mailer import send_match_email


def test_send_match_email():
    # For testing you can override the env vars here if needed,
    # or just rely on your .env when running via `python -m`.
    os.environ.setdefault("EMAIL_HOST", "smtp.gmail.com")
    os.environ.setdefault("EMAIL_PORT", "587")
    os.environ.setdefault("EMAIL_USER", "watmatch@gmail.com")
    os.environ.setdefault("EMAIL_PASSWORD", "")

    to_email = ""
    result = send_match_email(
        to_email=to_email,
        student_name="Test Student",
        project_title="Test Project",
    )
    print("Email sent:", result)



if __name__ == "__main__":
    test_send_match_email()
