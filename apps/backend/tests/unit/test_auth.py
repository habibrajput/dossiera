"""Unit tests for password verification and signed session tokens."""

import bcrypt
import pytest

from app.auth import (
    create_session_token,
    is_auth_enabled,
    verify_password,
    verify_session_token,
)
from app.config import settings


def test_auth_disabled_without_a_hash(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "app_password_hash", "")

    assert is_auth_enabled() is False
    assert verify_password("anything") is False


def test_password_verification_accepts_bcrypt_variants(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    password_hash = bcrypt.hashpw(b"secret", bcrypt.gensalt(rounds=4)).decode("ascii")
    monkeypatch.setattr(settings, "app_password_hash", password_hash)

    assert verify_password("secret") is True
    assert verify_password("wrong") is False

    for prefix in ("$2a$", "$2y$"):
        monkeypatch.setattr(settings, "app_password_hash", prefix + password_hash[4:])
        assert verify_password("secret") is True


def test_password_verification_rejects_long_and_invalid_hashes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    password_hash = bcrypt.hashpw(b"secret", bcrypt.gensalt(rounds=4)).decode("ascii")
    monkeypatch.setattr(settings, "app_password_hash", password_hash)

    assert verify_password("x" * 73) is False

    monkeypatch.setattr(settings, "app_password_hash", "not-a-bcrypt-hash")
    assert verify_password("secret") is False
    assert is_auth_enabled() is True


def test_session_token_round_trip_and_tampering() -> None:
    token = create_session_token()
    assert verify_session_token(token) is True

    encoded, _, signature = token.partition(".")
    assert verify_session_token(f"{encoded}.{'0' * len(signature)}") is False
    assert verify_session_token(f"{encoded[:-4]}abc.{signature}") is False
    assert verify_session_token("broken") is False


def test_expired_session_token_is_rejected() -> None:
    token = create_session_token(ttl_seconds=-10)
    assert verify_session_token(token) is False
