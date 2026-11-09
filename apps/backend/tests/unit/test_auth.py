"""Password hashing and opaque session primitives."""

import pytest

import app.auth as auth


@pytest.fixture(autouse=True)
def clear_sessions():
    auth._sessions.clear()
    yield
    auth._sessions.clear()


def test_password_hash_round_trip_and_unique_salts() -> None:
    first = auth.hash_password("correct horse", iterations=1_000)
    second = auth.hash_password("correct horse", iterations=1_000)

    assert first != second
    assert first.startswith("pbkdf2_sha256$1000$")
    assert auth.verify_password("correct horse", first)
    assert auth.verify_password("correct horse", second)
    assert not auth.verify_password("wrong horse", first)


@pytest.mark.parametrize(
    "encoded_hash",
    [
        "",
        "plaintext",
        "bcrypt$1000$c2FsdA==$aGFzaA==",
        "pbkdf2_sha256$nope$c2FsdA==$aGFzaA==",
        "pbkdf2_sha256$2000001$c2FsdA==$aGFzaA==",
        "pbkdf2_sha256$1000$not base64$aGFzaA==",
        "pbkdf2_sha256$1000$c2FsdA==$aGFzaA==",
        "pbkdf2_sha256$1000$c2FsdA==$aGFzaA==$extra",
    ],
)
def test_malformed_hashes_are_rejected(encoded_hash: str) -> None:
    assert not auth.verify_password("password", encoded_hash)


def test_hash_password_rejects_empty_password() -> None:
    with pytest.raises(ValueError, match="must not be empty"):
        auth.hash_password("")


def test_session_expiry_and_revocation(monkeypatch: pytest.MonkeyPatch) -> None:
    now = 100.0
    monkeypatch.setattr(auth.time, "monotonic", lambda: now)

    token = auth.create_session(ttl_seconds=60)
    assert auth.is_valid_session(token)

    now += 61
    assert not auth.is_valid_session(token)
    assert token not in auth._sessions

    active = auth.create_session(ttl_seconds=60)
    auth.revoke_session(active)
    assert not auth.is_valid_session(active)
    auth.revoke_session(None)


def test_session_status_depends_on_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(auth.settings, "auth_password_hash", "")
    assert not auth.auth_enabled()
    monkeypatch.setattr(auth.settings, "auth_password_hash", "pbkdf2-hash")
    assert auth.auth_enabled()
