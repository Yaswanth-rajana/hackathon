from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
print(pwd_context.verify("admin123", "$2b$12$pYDpX9zHAfVL68Dyk8twqOsZLiHOx547IIThJUAS7NKNjjm3wu9UK"))
print(pwd_context.verify("password", "$2b$12$pYDpX9zHAfVL68Dyk8twqOsZLiHOx547IIThJUAS7NKNjjm3wu9UK"))
