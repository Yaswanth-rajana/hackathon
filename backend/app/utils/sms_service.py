import requests
import os

FAST2SMS_API_KEY = os.getenv("FAST2SMS_API_KEY")
SMS_ENABLED = os.getenv("SMS_ENABLED", "false").lower() == "true"

def send_sms(mobile: str, message: str):
    if not SMS_ENABLED:
        return {"status": "disabled"}

    if not mobile or len(mobile) != 10:
        return {"status": "invalid_number"}

    if len(message) > 160:
        message = message[:157] + "..."

    url = "https://www.fast2sms.com/dev/bulkV2"

    headers = {
        "authorization": FAST2SMS_API_KEY
    }

    payload = {
        "message": message,
        "language": "english",
        "route": "q",
        "numbers": mobile
    }

    try:
        response = requests.post(url, data=payload, headers=headers)
        return response.json()
    except Exception as e:
        return {"status": "error", "error": str(e)}
