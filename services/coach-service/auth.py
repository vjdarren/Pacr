"""JWT verification dependency for FastAPI routes."""
from __future__ import annotations

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from config import settings

_bearer = HTTPBearer()
_public_key: str | None = None


def _get_public_key() -> str:
    global _public_key
    if _public_key is None:
        _public_key = settings.get_jwt_public_key()
    return _public_key


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    token = credentials.credentials
    try:
        payload = jwt.decode(
            token,
            _get_public_key(),
            algorithms=["RS256"],
        )
        user_id: str = payload["sub"]
        return user_id
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
