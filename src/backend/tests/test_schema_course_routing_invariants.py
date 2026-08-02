import re
import unittest
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = BACKEND_ROOT / "db" / "schema.sql"
CAPSTONES_CONTROLLER_PATH = BACKEND_ROOT / "src" / "capstones" / "controller.py"


def _normalized_sql() -> str:
    return SCHEMA_PATH.read_text(encoding="utf-8").lower()


def _function_sql(schema_sql: str, function_name: str) -> str:
    pattern = re.compile(
        rf"\bcreate\s+or\s+replace\s+function\s+{re.escape(function_name.lower())}\s*\(",
        re.IGNORECASE,
    )
    match = pattern.search(schema_sql)
    if not match:
        raise AssertionError(f"Function {function_name} was not found in schema.sql")

    terminator = schema_sql.find("\n$$;", match.end())
    if terminator == -1:
        raise AssertionError(f"Function {function_name} does not end with a $$; terminator")
    return schema_sql[match.start() : terminator]


def _assert_in_order(test_case: unittest.TestCase, body: str, fragments: list[str]) -> None:
    cursor = -1
    for fragment in fragments:
        next_index = body.find(fragment, cursor + 1)
        test_case.assertNotEqual(
            next_index,
            -1,
            f"Expected to find {fragment!r} after position {cursor}",
        )
        cursor = next_index


class CourseRoutingSchemaInvariantTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.schema = _normalized_sql()

    def function_sql(self, function_name: str) -> str:
        return _function_sql(self.schema, function_name)

    def test_course_readiness_assertion_keeps_all_routing_blockers(self) -> None:
        body = self.function_sql("watmatch_assert_course_ready_for_review")

        expected_guards = [
            "retired_for_routing",
            "activation_mode",
            "force_inactive",
            "watmatch_course_has_term_offering",
            "watmatch_course_has_active_term_offering",
            "watmatch_course_has_active_instructor",
            "watmatch_course_available_for_term",
            "watmatch_current_marketplace_term",
        ]
        for guard in expected_guards:
            with self.subTest(guard=guard):
                self.assertIn(guard, body)

    def test_course_availability_prefers_current_term_offerings_before_fallback(self) -> None:
        body = self.function_sql("watmatch_course_available_for_term")

        _assert_in_order(
            self,
            body,
            [
                "watmatch_course_has_term_offering",
                "watmatch_course_has_active_term_offering",
                "active_terms",
                "return watmatch_course_has_active_instructor",
            ],
        )
        self.assertIn(
            "return watmatch_course_has_active_term_offering(v_course.course_id, p_target_term)\n      and watmatch_course_has_active_instructor(v_course.course_id);",
            body,
        )

    def test_course_activation_sync_prefers_current_term_offerings_before_fallback(self) -> None:
        body = self.function_sql("watmatch_course_should_be_active")

        _assert_in_order(
            self,
            body,
            [
                "watmatch_course_has_active_instructor",
                "if watmatch_course_has_term_offering",
                "return watmatch_course_has_active_term_offering",
                "if v_mode = 'force_active'",
                "return v_current_season = any(v_terms)",
            ],
        )

    def test_live_course_routing_entrypoints_call_readiness_assertion(self) -> None:
        routing_entrypoints = [
            "watmatch_admin_route_capstone_course",
            "watmatch_create_project_submission_enrollment_request",
            "watmatch_decide_project_submission_enrollment_request",
            "watmatch_apply_marketplace_commitment",
        ]
        for function_name in routing_entrypoints:
            with self.subTest(function_name=function_name):
                body = self.function_sql(function_name)
                self.assertIn("watmatch_assert_course_ready_for_review", body)

    def test_admin_project_course_routing_requires_notes_for_changed_target(self) -> None:
        body = self.function_sql("watmatch_admin_route_capstone_course")

        expected_fragments = [
            "decision notes are required when routing changes the intended course",
            "v_previous_course_id := coalesce(v_capstone.requested_course_fk, v_team.course_fk, v_capstone.course_fk)",
            "p_target_course_id is distinct from v_previous_course_id",
            "course_routing_notes = coalesce(v_comments, course_routing_notes)",
            "'previous_course_fk', v_previous_course_id",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_submission_enrollment_request_allows_only_missing_or_unready_assigned_course(self) -> None:
        body = self.function_sql("watmatch_create_project_submission_enrollment_request")

        expected_fragments = [
            "v_assigned_course_ready",
            "your assigned course",
            "already assigned to an active staffed course",
            "v_student.course_fk",
            "assigned_course_blocker",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body.lower())

    def test_submission_enrollment_decisions_preserve_notes_and_allow_unready_course_reroute(self) -> None:
        body = self.function_sql("watmatch_decide_project_submission_enrollment_request")

        expected_fragments = [
            "decision notes are required when rejecting or cancelling",
            "v_assigned_course_ready",
            "current assigned course",
            "active staffed course assignment",
            "decision notes are required when approving a different enrollment course",
            "comments = coalesce(v_comments, v_request.comments)",
            "assigned_course_blocker",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body.lower())

    def test_commitment_approval_requires_notes_for_changed_routes(self) -> None:
        body = self.function_sql("watmatch_apply_marketplace_commitment")

        expected_fragments = [
            "decision notes are required when approving a changed coordinating or enrollment course route",
            "coalesce(v_capstone.requested_course_fk, v_team.course_fk, v_capstone.course_fk)",
            "v_member_enrollment_routes",
            "selected_route.route_text::bigint is distinct from coalesce",
            "coalesce(p_direct_routed, false) is not true",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body.lower())

    def test_marketplace_commitment_rpc_removes_legacy_overload(self) -> None:
        self.assertRegex(
            self.schema,
            r"drop\s+function\s+if\s+exists\s+watmatch_apply_marketplace_commitment\s*\(\s*bigint\s*,\s*bigint\s*,\s*bigint\s*,\s*text\s*,\s*text\s*,\s*bigint\s*,\s*text\s*,\s*boolean\s*\)\s*;",
        )

        body = self.function_sql("watmatch_create_project_commitment_request")
        self.assertRegex(
            body,
            r"watmatch_apply_marketplace_commitment\s*\([\s\S]*?true\s*,\s*null::jsonb\s*\)",
        )

    def test_submission_enrollment_queue_includes_current_and_requested_course_context(self) -> None:
        body = self.function_sql("watmatch_get_project_submission_enrollment_requests")

        expected_fragments = [
            "left join courses fc on fc.course_id = p.from_course_fk",
            "'from_course', to_jsonb(fc)",
            "'requested_course', to_jsonb(rc)",
            "p_course_id in (crr.from_course_fk, crr.to_course_fk, u.course_fk)",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_capstone_submission_entrypoints_guard_home_and_interdisciplinary_courses(self) -> None:
        submission_entrypoints = [
            "watmatch_create_capstone_with_new_team",
            "watmatch_create_capstone_for_existing_team",
        ]
        for function_name in submission_entrypoints:
            with self.subTest(function_name=function_name):
                body = self.function_sql(function_name)
                self.assertGreaterEqual(
                    body.count("watmatch_assert_course_ready_for_review"),
                    3,
                    "Submission must guard override, interdisciplinary, and assigned-course paths.",
                )
                self.assertIn("selected interdisciplinary course", body)
                self.assertIn("your assigned course", body)

    def test_membership_enrollment_courses_are_guarded_by_trigger(self) -> None:
        body = self.function_sql("watmatch_prevent_locked_team_membership_change")

        self.assertIn("official team members must have an enrollment course", body)
        self.assertIn("watmatch_assert_course_ready_for_review", body)
        self.assertIn("allow_membership_enrollment_reroute", body)

    def test_enrollment_reroutes_do_not_rewrite_leadership_in_cache_trigger(self) -> None:
        body = self.function_sql("watmatch_sync_membership_caches")

        self.assertIn("allow_membership_enrollment_reroute", body)
        self.assertIn(
            "allow_enrollment_reroute not in ('true', '1', 'yes', 'on')",
            body,
        )
        self.assertIn("set is_leader = false", body)

    def test_course_offering_clone_is_admin_audited_and_preserves_held_with_links(self) -> None:
        body = self.function_sql("watmatch_admin_clone_course_offerings")

        expected_fragments = [
            "watmatch_assert_admin_actor",
            "source and target terms must be different",
            "p_overwrite_existing",
            "course_offering_held_with",
            "held_with_offering_fk",
            "target_sibling.term = v_target_term",
            "when 'archived' then 3",
            "unresolved_held_with_count",
            "watmatch_sync_single_course_activation",
            "course_offerings_cloned",
            "manual_registrar_update_required",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_catalog_deactivation_transitions_require_audit_reasons(self) -> None:
        expectations = {
            "watmatch_admin_upsert_course": [
                "v_activation_mode = 'force_inactive'",
                "v_reason is null",
                "forcing a course inactive requires an audit reason",
                "'course'",
                "v_reason",
            ],
            "watmatch_admin_update_project_ecosystem": [
                "v_active is false",
                "v_reason is null",
                "project ecosystem deactivation requires an audit reason",
                "'project_ecosystem'",
                "v_reason",
            ],
        }

        for function_name, fragments in expectations.items():
            body = self.function_sql(function_name)
            for fragment in fragments:
                with self.subTest(function_name=function_name, fragment=fragment):
                    self.assertIn(fragment, body)

    def test_privileged_roster_mutations_require_audit_reasons(self) -> None:
        expectations = {
            "watmatch_privileged_create_team": [
                "managed team creation requires an audit reason",
                "v_reason is null",
                "'team_created_by_privileged_user'",
            ],
            "watmatch_privileged_add_team_member": [
                "privileged member add requires an audit reason",
                "v_reason is null",
                "'team_member_added'",
            ],
            "watmatch_privileged_remove_team_member": [
                "privileged member removal requires an audit reason",
                "v_reason is null",
                "'team_member_removed'",
            ],
            "watmatch_disband_team": [
                "v_role in ('admin', 'instructor') and v_reason is null",
                "privileged team disband requires an audit reason",
                "'team_disbanded'",
            ],
            "watmatch_reassign_team_leader": [
                "v_role in ('admin', 'instructor') and v_reason is null",
                "privileged leader reassignment requires an audit reason",
                "'team_leader_reassigned'",
            ],
        }

        for function_name, fragments in expectations.items():
            body = self.function_sql(function_name)
            for fragment in fragments:
                with self.subTest(function_name=function_name, fragment=fragment):
                    self.assertIn(fragment, body)

    def test_privileged_capstone_archive_requires_audit_reason(self) -> None:
        body = self.function_sql("watmatch_archive_capstone")

        expected_fragments = [
            "privileged capstone archive requires an audit reason",
            "v_reason is null",
            "archived_reason = v_reason",
            "'capstone_archived'",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_capstone_completion_requires_human_notes(self) -> None:
        body = self.function_sql("watmatch_complete_capstone")

        expected_fragments = [
            "capstone completion notes are required",
            "v_notes is null",
            "'capstone_completed'",
            "values (p_capstone_id, p_actor_id, 'capstone_completed', v_notes)",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_closeout_decisions_require_human_notes(self) -> None:
        body = self.function_sql("watmatch_apply_capstone_closeout_decision")

        expected_fragments = [
            "closeout decision notes are required",
            "v_notes is null",
            "closeout_notes = v_notes",
            "perform watmatch_archive_capstone(p_capstone_id, p_actor_id, 'admin', v_notes)",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_marketplace_activity_resolution_requires_audit_reason(self) -> None:
        body = self.function_sql("watmatch_resolve_marketplace_activity_for_finalization")

        expected_fragments = [
            "marketplace activity resolution requires an audit reason",
            "v_reason is null",
            "comments = coalesce(pcr.comments, v_reason)",
            "'marketplace_activity_resolved_for_finalization'",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_admin_user_management_requires_audit_reasons(self) -> None:
        expectations = {
            "watmatch_admin_create_user": [
                "admin user creation requires an audit reason",
                "v_reason is null",
                "'user_created'",
            ],
            "watmatch_admin_set_user_course": [
                "admin user course changes require an audit reason",
                "v_reason is null",
                "'user_course_assigned'",
            ],
            "watmatch_admin_set_user_active": [
                "admin user active-status changes require an audit reason",
                "v_reason is null",
                "'user_deactivated'",
            ],
            "watmatch_admin_update_user": [
                "admin user updates require an audit reason",
                "v_reason is null",
                "'user_updated'",
            ],
            "watmatch_admin_delete_user": [
                "admin user deletion requires an audit reason",
                "v_reason is null",
                "'user_deleted'",
            ],
        }

        for function_name, fragments in expectations.items():
            body = self.function_sql(function_name)
            for fragment in fragments:
                with self.subTest(function_name=function_name, fragment=fragment):
                    self.assertIn(fragment, body)

    def test_department_deactivation_requires_an_audit_reason(self) -> None:
        body = self.function_sql("watmatch_admin_upsert_department")

        expected_fragments = [
            "v_existing_active boolean",
            "v_reason text := nullif(btrim(coalesce(p_reason, '')), '')",
            "v_existing_active is true and v_active is false and v_reason is null",
            "a reason is required to deactivate a department",
            "'department'",
            "v_reason",
        ]
        for fragment in expected_fragments:
            with self.subTest(fragment=fragment):
                self.assertIn(fragment, body)

    def test_admin_past_capstone_management_requires_audit_reasons(self) -> None:
        expectations = {
            "watmatch_admin_upsert_past_capstone": [
                "past capstone manual changes require an audit reason",
                "v_reason is null",
                "'past_capstone_created'",
                "'past_capstone_updated'",
            ],
            "watmatch_admin_delete_past_capstone": [
                "past capstone deletion requires an audit reason",
                "v_reason is null",
                "'past_capstone_deleted'",
            ],
        }

        for function_name, fragments in expectations.items():
            body = self.function_sql(function_name)
            for fragment in fragments:
                with self.subTest(function_name=function_name, fragment=fragment):
                    self.assertIn(fragment, body)

    def test_admin_external_partner_management_requires_audit_reasons(self) -> None:
        expectations = {
            "watmatch_upsert_partner_profile": [
                "admin partner profile changes require an audit reason",
                "v_role = 'admin' and v_reason is null",
                "'partner_profile_upserted'",
                "'reason', v_reason",
            ],
            "watmatch_upsert_partner_opportunity": [
                "admin partner opportunity changes require an audit reason",
                "v_role = 'admin' and v_reason is null",
                "'partner_opportunity_created'",
                "'partner_opportunity_updated'",
                "'reason', v_reason",
            ],
        }

        for function_name, fragments in expectations.items():
            body = self.function_sql(function_name)
            for fragment in fragments:
                with self.subTest(function_name=function_name, fragment=fragment):
                    self.assertIn(fragment, body)

    def test_legacy_icapstone_route_values_are_not_reintroduced(self) -> None:
        controller = CAPSTONES_CONTROLLER_PATH.read_text(encoding="utf-8").lower()

        self.assertNotIn("'icapstone'", self.schema)
        self.assertNotIn('"icapstone"', self.schema)
        self.assertNotIn("'icapstone'", controller)
        self.assertNotIn('"icapstone"', controller)

        self.assertIn("capstones_submission_track_check", self.schema)
        self.assertIn(
            "submission_track in ('home_course', 'interdisciplinary')",
            self.schema,
        )
        self.assertIn("project_commitment_requests_route_check", self.schema)
        self.assertIn(
            "decision_route in ('course_enrolled', 'interdisciplinary', 'other_course')",
            self.schema,
        )
        self.assertIn(
            'if normalized not in {"home_course", "interdisciplinary"}:',
            controller,
        )
        self.assertIn("unsupported capstone submission track", controller)


if __name__ == "__main__":
    unittest.main()
