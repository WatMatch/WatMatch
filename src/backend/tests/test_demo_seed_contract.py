import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SEED_PATH = BACKEND_ROOT / "db" / "demo_seed.sql"


def _normalized_seed() -> str:
    return SEED_PATH.read_text(encoding="utf-8").lower()


def _without_line_comments(sql: str) -> str:
    return re.sub(r"--[^\n]*", "", sql)


class DemoSeedContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.seed = _normalized_seed()
        cls.executable_seed = _without_line_comments(cls.seed)

    def test_seed_does_not_write_protected_catalog_tables(self) -> None:
        protected = [
            "faculties",
            "departments",
            "courses",
            "course_offerings",
            "course_offering_held_with",
            "project_ecosystems",
            "skills",
            "past_capstones",
        ]
        for table in protected:
            with self.subTest(table=table):
                self.assertNotRegex(
                    self.executable_seed,
                    rf"\b(insert\s+into|update|delete\s+from|truncate\s+table)\s+{table}\b",
                )

    def test_seed_keeps_triggers_and_constraints_enabled(self) -> None:
        self.assertNotIn("disable trigger", self.executable_seed)
        self.assertNotIn("session_replication_role", self.executable_seed)
        self.assertIn("set constraints all deferred", self.executable_seed)
        self.assertIn("watmatch_claim_team_membership", self.executable_seed)
        self.assertIn("watmatch_finalize_team", self.executable_seed)
        self.assertIn("watmatch_complete_capstone", self.executable_seed)

    def test_seed_rejects_legacy_commitment_rpc_before_reset(self) -> None:
        legacy_signature = (
            "public.watmatch_apply_marketplace_commitment"
            "(bigint,bigint,bigint,text,text,bigint,text,boolean)"
        )
        current_signature = f"{legacy_signature[:-1]},jsonb)"

        self.assertIn(legacy_signature, self.executable_seed)
        self.assertIn(current_signature, self.executable_seed)
        self.assertIn("legacy marketplace commitment rpc overload", self.seed)
        self.assertLess(
            self.executable_seed.index(legacy_signature),
            self.executable_seed.index("update users"),
            "RPC compatibility must be checked before the seed resets mutable data.",
        )

    def test_seed_requires_the_read_only_historical_archive(self) -> None:
        self.assertIn("if not exists (select 1 from past_capstones)", self.executable_seed)
        self.assertIn("load the past-capstone archive before seeding the mid 2 demo", self.seed)

    def test_core_demo_accounts_and_projects_are_present(self) -> None:
        required_accounts = [
            "student.se.explorer@uwaterloo.ca",
            "student.se.leader@uwaterloo.ca",
            "mentor.lee@uwaterloo.ca",
            "instructor.mte@uwaterloo.ca",
            "student.mte.review@uwaterloo.ca",
            "external.partner@uwaterloo.ca",
        ]
        required_projects = [
            "campus accessibility navigator",
            "peer study room finder",
            "clinical flow simulator",
            "hospital scheduling optimizer",
            "unsupported finalization blocker",
        ]
        for value in required_accounts + required_projects:
            with self.subTest(value=value):
                self.assertIn(value, self.seed)

    def test_campus_relationships_begin_in_actionable_states(self) -> None:
        self.assertIn(
            "(v_cap, v_team, v_explorer, 'interested', 'student_marketplace'",
            self.seed,
        )
        self.assertIn(
            "(v_cap, v_team, v_no_course, 'invited', 'team_invite'",
            self.seed,
        )
        self.assertNotIn("'leader_invite'", self.seed)
        self.assertIn("campus explorer must start as interested and unofficial", self.seed)
        self.assertIn("campus must include one unresolved team invite", self.seed)

    def test_same_course_commitment_fixture_is_mutually_confirmed_but_not_routed(self) -> None:
        self.assertIn(
            "v_direct_candidate, 'exploring', 'project_interest_acceptance'",
            self.seed,
        )
        self.assertIn("pe.student_commitment_confirmed_at is not null", self.seed)
        self.assertIn("pe.team_commitment_confirmed_at is not null", self.seed)
        self.assertIn("t.commitment_roster_confirmed_at is null", self.seed)

    def test_review_mentor_partner_and_blocker_states_are_asserted(self) -> None:
        expected_assertions = [
            "campus mentor request must be pending",
            "clinical flow simulator must await instructor review",
            "bme proposal must retain published partner context and confirmed support",
            "finalization blocker must require and lack project support",
            "transit equity scenario planner must be finalized",
            "clinic intake triage dashboard must be complete",
        ]
        for assertion in expected_assertions:
            with self.subTest(assertion=assertion):
                self.assertIn(assertion, self.seed)

    def test_past_shortlist_demo_starts_empty_and_can_be_repeated(self) -> None:
        self.assertIn("delete from student_past_capstone_shortlists", self.executable_seed)
        self.assertNotRegex(
            self.executable_seed,
            r"\binsert\s+into\s+student_past_capstone_shortlists\b",
        )
        self.assertIn("the explorer must start without saved past capstones", self.seed)

    def test_seed_is_lean_and_self_validating(self) -> None:
        self.assertNotIn("student.state.", self.seed)
        self.assertNotIn("marketplace state catalog", self.seed)
        expected_counts = [
            "expected 9 capstones",
            "expected 9 teams",
            "expected 10 official memberships",
            "expected 4 marketplace relationships",
            "expected 2 partner opportunities",
            "'projects_seeded', 9",
        ]
        for count_contract in expected_counts:
            with self.subTest(count_contract=count_contract):
                self.assertIn(count_contract, self.seed)


if __name__ == "__main__":
    unittest.main()
