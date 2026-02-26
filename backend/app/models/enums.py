from enum import Enum

class TransactionType(str, Enum):
    DISTRIBUTION = "DISTRIBUTION"
    ALLOCATION = "ALLOCATION"
    COMPLAINT = "COMPLAINT"
    ML_ALERT = "ML_ALERT"
    CASH_TRANSFER = "CASH_TRANSFER"
