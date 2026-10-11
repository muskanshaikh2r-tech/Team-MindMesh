"""Sign-up, OTP email verification, login, sessions. Standard library only."""
import hashlib
import hmac
import re
import secrets
import smtplib
import time
from email.message import EmailMessage

import config
from database import db

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class AuthError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.message, self.status = message, status


def _hash(password: str, salt: bytes) -> str:
    return hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 200_000).hex()


def _public(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"]}


def create_user(name, email, password, verified=False):
    email = email.strip().lower()
    name = name.strip()
    if not name:
        raise AuthError("Enter your name.")
    if not EMAIL_RE.match(email):
        raise AuthError("Enter a valid email address.")
    if len(password) < 8:
        raise AuthError("Password must be at least 8 characters.")
    salt = secrets.token_bytes(16)
    with db() as c:
        existing = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if existing and existing["verified"]:
            raise AuthError("An account with this email already exists. Log in instead.", 409)
        if existing:  # unverified earlier attempt: let them re-register
            c.execute("UPDATE users SET name=?, salt=?, password_hash=? WHERE email=?",
                      (name, salt.hex(), _hash(password, salt), email))
        else:
            c.execute(
                "INSERT INTO users(name,email,salt,password_hash,verified,created_at) VALUES(?,?,?,?,?,?)",
                (name, email, salt.hex(), _hash(password, salt), int(verified), time.time()),
            )
    return email


def ensure_demo_user():
    try:
        create_user(config.DEMO_NAME, config.DEMO_EMAIL, config.DEMO_PASSWORD, verified=True)
    except AuthError:
        pass  # already exists


def _send_email(to, code):
    msg = EmailMessage()
    msg["Subject"] = "Your VORTEXA verification code"
    msg["From"], msg["To"] = config.SMTP_FROM, to
    msg.set_content(f"Your verification code is {code}. It expires in {config.OTP_TTL_SECONDS // 60} minutes.")
    with smtplib.SMTP(config.SMTP_HOST, config.SMTP_PORT, timeout=10) as s:
        s.starttls()
        if config.SMTP_USER:
            s.login(config.SMTP_USER, config.SMTP_PASSWORD)
        s.send_message(msg)


def issue_otp(email):
    """Create + deliver a 6-digit OTP. Returns the code only in development mode."""
    email = email.strip().lower()
    with db() as c:
        user = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
        if not user:
            raise AuthError("No account found for this email.", 404)
        code = f"{secrets.randbelow(10**6):06d}"
        c.execute(
            "INSERT INTO otps(email,code,expires_at,attempts) VALUES(?,?,?,0) "
            "ON CONFLICT(email) DO UPDATE SET code=excluded.code, expires_at=excluded.expires_at, attempts=0",
            (email, code, time.time() + config.OTP_TTL_SECONDS),
        )
    if config.SMTP_HOST:
        try:
            _send_email(email, code)
        except Exception as exc:  # noqa: BLE001
            print(f"[auth] SMTP send failed: {exc}")
    print(f"[auth] OTP for {email}: {code}")  # dev convenience
    return code if config.DEV_MODE else None


def verify_otp(email, code):
    email = email.strip().lower()
    with db() as c:
        row = c.execute("SELECT * FROM otps WHERE email=?", (email,)).fetchone()
        if not row:
            raise AuthError("No code was requested for this email. Request a new one.")
        if row["expires_at"] < time.time():
            raise AuthError("This code has expired. Request a new one.")
        if row["attempts"] >= config.OTP_MAX_ATTEMPTS:
            raise AuthError("Too many wrong attempts. Request a new code.", 429)
        if not hmac.compare_digest(row["code"], code.strip()):
            c.execute("UPDATE otps SET attempts=attempts+1 WHERE email=?", (email,))
            c.commit()
            raise AuthError("That code is incorrect.")
        c.execute("UPDATE users SET verified=1 WHERE email=?", (email,))
        c.execute("DELETE FROM otps WHERE email=?", (email,))
        user = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return _public(user), create_session(user["id"])


def login(email, password):
    email = email.strip().lower()
    with db() as c:
        user = c.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    if not user or not hmac.compare_digest(_hash(password, bytes.fromhex(user["salt"])), user["password_hash"]):
        raise AuthError("Email or password is incorrect.", 401)
    if not user["verified"]:
        raise AuthError("Verify your email first. We can send a new code.", 403)
    return _public(user), create_session(user["id"])


def create_session(user_id):
    token = secrets.token_urlsafe(32)
    with db() as c:
        c.execute("INSERT INTO sessions(token,user_id,expires_at) VALUES(?,?,?)",
                  (token, user_id, time.time() + config.SESSION_TTL_SECONDS))
    return token


def user_from_token(token):
    with db() as c:
        row = c.execute(
            "SELECT u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=? AND s.expires_at>?",
            (token, time.time()),
        ).fetchone()
    return _public(row) if row else None


def logout(token):
    with db() as c:
        c.execute("DELETE FROM sessions WHERE token=?", (token,))
