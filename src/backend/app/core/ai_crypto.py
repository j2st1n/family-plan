import base64
import hashlib
import os
import re
from typing import Optional

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import settings

_DERIVED_KEY_SALT = b"family-plan:ai-crypto:v1:"


def derive_ai_encryption_key() -> bytes:
    """
    基于服务端密钥派生 256 位 (32 字节) 对称加密密钥。
    优先读取 settings.ai_encryption_key，其次回退至 settings.jwt_secret。
    """
    secret_src = (
        getattr(settings, "ai_encryption_key", "")
        or settings.jwt_secret
        or "family-plan-ai-key-secret-fallback-32b"
    ).encode("utf-8")
    return hashlib.sha256(_DERIVED_KEY_SALT + secret_src).digest()


def encrypt_ai_api_key(plain_key: Optional[str]) -> Optional[str]:
    """
    使用 AES-256-GCM 加密 API Key。
    输出格式为带版本前缀的 Base64 密文字符串：gcm:<base64(nonce_12B + ciphertext_with_tag)>。
    """
    if not plain_key or not plain_key.strip():
        return None

    clean_plain = plain_key.strip()
    key = derive_ai_encryption_key()
    aesgcm = AESGCM(key)
    nonce = os.urandom(12)  # 96-bit standard nonce for AES-GCM
    data = clean_plain.encode("utf-8")
    ciphertext = aesgcm.encrypt(nonce, data, None)
    encoded = base64.b64encode(nonce + ciphertext).decode("ascii")
    return f"gcm:{encoded}"


def decrypt_ai_api_key(encrypted_str: Optional[str]) -> Optional[str]:
    """
    解密 AES-256-GCM 加密的 API Key 密文。
    解密失败或格式非法返回 None，绝不抛出未处理异常。
    """
    if not encrypted_str or not encrypted_str.strip():
        return None

    raw_val = encrypted_str.strip()
    if raw_val.startswith("gcm:"):
        raw_val = raw_val[4:]

    try:
        raw_bytes = base64.b64decode(raw_val.encode("ascii"))
        if len(raw_bytes) < 12 + 16:  # 12-byte nonce + 16-byte GCM tag
            return None
        nonce = raw_bytes[:12]
        ciphertext = raw_bytes[12:]
        key = derive_ai_encryption_key()
        aesgcm = AESGCM(key)
        plain_bytes = aesgcm.decrypt(nonce, ciphertext, None)
        return plain_bytes.decode("utf-8")
    except Exception:
        return None


def mask_api_key(plain_key: Optional[str]) -> str:
    """
    接口返回时将 API Key 严格脱敏打码（如 sk-****3a8f）。
    绝不向前端暴露完整明文。
    """
    if not plain_key or not plain_key.strip():
        return ""

    k = plain_key.strip()
    # 标准 sk- 格式 API Key (如 sk-1234567890abcdef3a8f)
    if k.startswith("sk-") and len(k) > 7:
        return f"sk-****{k[-4:]}"

    # 较短密钥
    if len(k) <= 8:
        if len(k) <= 4:
            return "****"
        return f"****{k[-4:]}"

    # 通用长密钥：保留前3位与后4位
    return f"{k[:3]}****{k[-4:]}"


def is_masked_api_key(val: Optional[str]) -> bool:
    """
    判断传入字符串是否为已脱敏打码格式，用于 PUT 更新时辨识是否保持原 Key。
    """
    if not val or not val.strip():
        return False
    v = val.strip()
    if v.startswith("sk-****") or v.startswith("****"):
        return True
    if re.match(r"^[a-zA-Z0-9_\-]{1,6}\*{3,}[a-zA-Z0-9_\-]{2,6}$", v):
        return True
    return False
