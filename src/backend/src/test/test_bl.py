from .test_dl import TestDataLogic
from typing import Dict, Any


class TestBusinessLogic:
    """Business layer for test operations"""
    
    def __init__(self):
        self.data_logic = TestDataLogic()
    
    def get_test_by_id(self, test_id: int) -> Dict[str, Any]:
        """Get test record by ID with validation"""
        try:
            if not isinstance(test_id, int) or test_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid test ID. Must be a positive integer.",
                    "data": None
                }
            
            test_data = self.data_logic.get_by_id(test_id)
            
            if test_data is None:
                return {
                    "success": False,
                    "message": f"Test record with ID {test_id} not found",
                    "data": None
                }
            
            processed_data = self._process_test_data(test_data)
            
            return {
                "success": True,
                "message": "Test record retrieved successfully",
                "data": processed_data
            }
            
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }
    
    def _process_test_data(self, test_data: Dict[Any, Any]) -> Dict[Any, Any]:
        """Process test data with metadata"""
        processed = dict(test_data)
        processed['processed_at'] = True
        processed['source'] = 'watmatch-server'
        
        return processed