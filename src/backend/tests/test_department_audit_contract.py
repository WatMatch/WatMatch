import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
CONTROLLER_PATH = BACKEND_ROOT / "src" / "departments" / "controller.py"
BUSINESS_PATH = BACKEND_ROOT / "src" / "departments" / "departments_bl.py"
DATA_PATH = BACKEND_ROOT / "src" / "departments" / "departments_dl.py"


def _source(path: Path) -> str:
    return path.read_text(encoding="utf-8").lower()


def _method_body(source: str, method_name: str) -> str:
    match = re.search(rf"\n    def {re.escape(method_name.lower())}\s*\(", source)
    if not match:
        raise AssertionError(f"Method {method_name} was not found")
    next_method = source.find("\n    def ", match.end())
    return source[match.start() : next_method if next_method != -1 else None]


class DepartmentAuditContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.controller = _source(CONTROLLER_PATH)
        cls.business = _source(BUSINESS_PATH)
        cls.data = _source(DATA_PATH)
        cls.update_business = _method_body(cls.business, "update_department")
        cls.upsert_data = _method_body(cls.data, "upsert_department_rpc")

    def test_update_request_and_controller_forward_optional_reason(self) -> None:
        update_route = self.controller[self.controller.index('@router.patch("/{department_id}")') :]
        self.assertIn("reason: optional[str] = field(default=none, max_length=2000)", self.controller)
        self.assertIn("reason=request.reason", update_route)

    def test_business_requires_reason_only_for_active_to_inactive_transition(self) -> None:
        expected = [
            "reason: optional[str] = none",
            "clean_reason = reason.strip()",
            'existing.get("active") is true and next_active is false and not clean_reason',
            "a reason is required to deactivate a department",
            'reason=clean_reason or "admin_department_management"',
        ]
        for fragment in expected:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, self.update_business)

    def test_data_layer_passes_reason_to_existing_rpc_parameter(self) -> None:
        self.assertIn('"watmatch_admin_upsert_department"', self.upsert_data)
        self.assertIn('"p_reason": reason', self.upsert_data)


if __name__ == "__main__":
    unittest.main()
