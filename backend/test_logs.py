import requests
import json
import sqlite3

try:
    conn = sqlite3.connect('app.sqlite')
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users WHERE role='admin' LIMIT 1")
    admin_id = cursor.fetchone()[0]
    
    # We can just mock a token by doing a quick login, but we don't know password.
    # Alternatively we just look at the uvicorn output again.
except Exception as e:
    print(e)
