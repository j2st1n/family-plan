import bcrypt

from app.core.security import hash_password, verify_password


def test_existing_bcrypt_passwords_still_verify_without_passlib(caplog):
    stored = bcrypt.hashpw(b'existing-password', bcrypt.gensalt()).decode('ascii')
    assert verify_password('existing-password', stored)
    assert not verify_password('wrong-password', stored)
    assert not caplog.records


def test_password_hash_round_trip_and_invalid_hash():
    assert verify_password('new-password', hash_password('new-password'))
    assert not verify_password('new-password', 'invalid-hash')


def test_legacy_utf8_password_truncation_remains_compatible():
    password = '长密码' * 15
    stored = bcrypt.hashpw(password.encode('utf-8')[:72], bcrypt.gensalt()).decode('ascii')
    assert verify_password(password, stored)
