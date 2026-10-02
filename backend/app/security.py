import os, datetime as dt, bcrypt, jwt
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from .db import get_db
from .models import User

SECRET = os.environ["JWT_SECRET"]
oauth2 = OAuth2PasswordBearer(tokenUrl="auth/login")

def hash_pw(p: str) -> str: return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
def check_pw(p: str, h: str) -> bool: return bcrypt.checkpw(p.encode(), h.encode())

def make_token(user: User) -> str:
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=int(os.getenv("JWT_MINUTES", 60)))
    return jwt.encode({"sub": str(user.id), "exp": exp}, SECRET, algorithm="HS256")

def make_password_reset_token(user: User) -> str:
    exp = dt.datetime.now(dt.timezone.utc) + dt.timedelta(minutes=30)
    return jwt.encode({"sub": str(user.id), "purpose": "password_reset", "password_hash": user.password_hash,
                       "exp": exp}, SECRET, algorithm="HS256")

def current_user(token: str = Depends(oauth2), db: Session = Depends(get_db)) -> User:
    try:
        uid = int(jwt.decode(token, SECRET, algorithms=["HS256"])["sub"])
    except Exception:
        raise HTTPException(401, "Token inválido o expirado")
    user = db.get(User, uid)
    if not user: raise HTTPException(401, "Usuario no existe")
    return user

def require(*roles: str):
    def dep(u: User = Depends(current_user)) -> User:
        if u.role != "ADMIN" and u.role not in roles:
            raise HTTPException(403, "Sin permiso")
        return u
    return dep
