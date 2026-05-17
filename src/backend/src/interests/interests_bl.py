# business/interests_bl.py
from typing import Dict, Any, Optional
from .interests_dl import InterestsDL

class InterestsBusiness:
    def __init__(self):
        self.dl = InterestsDL()

    def express_interest(self, capstone_id: int, student_id: int, message: Optional[str]) -> Dict[str, Any]:
        return self.dl.add_interest(capstone_id, student_id, message)

    def withdraw_interest(self, capstone_id: int, student_id: int) -> Dict[str, Any]:
        return self.dl.remove_interest(capstone_id, student_id)

    def list_interested(self, capstone_id: int) -> Dict[str, Any]:
        return self.dl.get_interested_students(capstone_id)
