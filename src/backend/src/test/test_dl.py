from src.config.database import supabase
from typing import Optional, Dict, Any


class TestDataLogic:
    """Data layer for test operations"""
    
    def __init__(self):
        self.table_name = "samson_test"
    
    def get_by_id(self, test_id: int) -> Optional[Dict[Any, Any]]:
        """Fetch test record by ID"""
        try:
            response = supabase.table(self.table_name).select("*").eq("id", test_id).execute()
            
            if not response.data:
                return None
                
            return response.data[0]
            
        except Exception as e:
            raise Exception(f"Database error in get_by_id: {str(e)}")