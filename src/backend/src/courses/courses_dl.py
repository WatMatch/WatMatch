from typing import Optional, Dict, Any, List
from src.config.database import supabase
from src.workflow.rpc_utils import call_json_rpc


class CoursesDataLogic:
    def __init__(self) -> None:
        self.table_name = "courses"

    def _current_marketplace_phase(self) -> str:
        try:
            settings = (
                supabase.table("marketplace_settings")
                .select("phase")
                .eq("setting_id", 1)
                .limit(1)
                .execute()
                .data
                or [None]
            )[0]
            return self._normalize_phase((settings or {}).get("phase")) or "exploration"
        except Exception:
            return "exploration"

    def _current_marketplace_term(self) -> Optional[str]:
        try:
            settings = (
                supabase.table("marketplace_settings")
                .select("current_term")
                .eq("setting_id", 1)
                .limit(1)
                .execute()
                .data
                or [None]
            )[0]
            term = (settings or {}).get("current_term")
            return str(term).strip() if term else None
        except Exception:
            return None

    @staticmethod
    def _normalize_phase(phase: Any) -> Optional[str]:
        value = str(phase or "").strip().lower()
        if not value:
            return None
        if value == "locked":
            return "finalization"
        return value if value in {"exploration", "commitment", "finalization"} else None

    def _phase_context_for_ecosystem(
        self,
        ecosystem: Optional[Dict[str, Any]],
        global_phase: str,
    ) -> Dict[str, Any]:
        if not ecosystem:
            return {
                "global_phase": global_phase,
                "effective_phase": global_phase,
                "override_source": "global",
                "course_id": None,
                "ecosystem_id": None,
                "reason": None,
                "updated_by_fk": None,
                "updated_at": None,
            }

        override = self._normalize_phase(ecosystem.get("marketplace_phase_override"))
        is_overridable = (
            ecosystem.get("active") is True
            and str(ecosystem.get("name") or "").lower() != "departmental"
            and override is not None
        )
        return {
            "global_phase": global_phase,
            "effective_phase": override if is_overridable else global_phase,
            "override_source": "ecosystem" if is_overridable else "global",
            "course_id": None,
            "ecosystem_id": ecosystem.get("ecosystem_id") if is_overridable else None,
            "reason": ecosystem.get("marketplace_phase_override_reason") if is_overridable else None,
            "updated_by_fk": ecosystem.get("marketplace_phase_override_updated_by_fk") if is_overridable else None,
            "updated_at": ecosystem.get("marketplace_phase_override_updated_at") if is_overridable else None,
        }

    def _phase_context_for_course(
        self,
        course: Dict[str, Any],
        ecosystem: Optional[Dict[str, Any]],
        global_phase: str,
    ) -> Dict[str, Any]:
        routing_kind = course.get("routing_kind") or "standard"
        if routing_kind == "interdisciplinary":
            return self._phase_context_for_ecosystem(ecosystem, global_phase)

        override = self._normalize_phase(course.get("marketplace_phase_override"))
        is_overridden = override is not None
        return {
            "global_phase": global_phase,
            "effective_phase": override if is_overridden else global_phase,
            "override_source": "course" if is_overridden else "global",
            "course_id": course.get("course_id") if is_overridden else None,
            "ecosystem_id": None,
            "reason": course.get("marketplace_phase_override_reason") if is_overridden else None,
            "updated_by_fk": course.get("marketplace_phase_override_updated_by_fk") if is_overridden else None,
            "updated_at": course.get("marketplace_phase_override_updated_at") if is_overridden else None,
        }

    def upsert_course_rpc(
        self,
        course_id: Optional[int],
        code: str,
        name: str,
        active_terms: List[str],
        activation_mode: str,
        department_id: Optional[int],
        ecosystem_id: Optional[int],
        routing_kind: str,
        marketplace_phase_override: Optional[str],
        marketplace_phase_override_reason: Optional[str],
        requires_project_support: bool,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_upsert_course",
            {
                "p_course_id": course_id,
                "p_code": code,
                "p_name": name,
                "p_active_terms": active_terms,
                "p_activation_mode": activation_mode,
                "p_department_id": department_id,
                "p_ecosystem_id": ecosystem_id,
                "p_routing_kind": routing_kind,
                "p_marketplace_phase_override": marketplace_phase_override,
                "p_marketplace_phase_override_reason": marketplace_phase_override_reason,
                "p_requires_project_support": requires_project_support,
                "p_actor_id": actor_id,
                "p_reason": reason,
            },
        )

    def update_project_ecosystem_rpc(
        self,
        ecosystem_id: int,
        description: Optional[str],
        active: Optional[bool],
        marketplace_phase_override: Optional[str],
        marketplace_phase_override_reason: Optional[str],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_update_project_ecosystem",
            {
                "p_ecosystem_id": ecosystem_id,
                "p_description": description,
                "p_active": active,
                "p_marketplace_phase_override": marketplace_phase_override,
                "p_marketplace_phase_override_reason": marketplace_phase_override_reason,
                "p_actor_id": actor_id,
                "p_reason": reason,
            },
        )

    def upsert_pipeline_edge_rpc(
        self,
        edge_id: Optional[int],
        from_course_id: int,
        to_course_id: int,
        active: bool,
        is_default: bool,
        notes: Optional[str],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_upsert_course_pipeline_edge",
            {
                "p_edge_id": edge_id,
                "p_from_course_id": from_course_id,
                "p_to_course_id": to_course_id,
                "p_active": active,
                "p_is_default": is_default,
                "p_notes": notes,
                "p_actor_id": actor_id,
                "p_reason": reason,
            },
        )

    def upsert_course_offering_rpc(
        self,
        offering_id: Optional[int],
        course_id: int,
        term: str,
        title_override: Optional[str],
        description: Optional[str],
        topic: Optional[str],
        section_label: Optional[str],
        status: str,
        routing_kind_override: Optional[str],
        ecosystem_id: Optional[int],
        requires_project_support: Optional[bool],
        student_registration_notes: Optional[str],
        admin_routing_notes: Optional[str],
        source_url: Optional[str],
        held_with_course_ids: List[int],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_upsert_course_offering",
            {
                "p_course_offering_id": offering_id,
                "p_course_id": course_id,
                "p_term": term,
                "p_title_override": title_override,
                "p_description": description,
                "p_topic": topic,
                "p_section_label": section_label,
                "p_status": status,
                "p_routing_kind_override": routing_kind_override,
                "p_ecosystem_id": ecosystem_id,
                "p_requires_project_support": requires_project_support,
                "p_student_registration_notes": student_registration_notes,
                "p_admin_routing_notes": admin_routing_notes,
                "p_source_url": source_url,
                "p_held_with_course_ids": held_with_course_ids,
                "p_actor_id": actor_id,
                "p_reason": reason,
            },
        )

    def clone_course_offerings_rpc(
        self,
        source_term: str,
        target_term: str,
        target_status: str,
        overwrite_existing: bool,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return call_json_rpc(
            "watmatch_admin_clone_course_offerings",
            {
                "p_source_term": source_term,
                "p_target_term": target_term,
                "p_target_status": target_status,
                "p_overwrite_existing": overwrite_existing,
                "p_actor_id": actor_id,
                "p_reason": reason,
            },
        )

    def _enrich_courses(self, courses: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        course_ids = [
            course.get("course_id")
            for course in courses
            if course.get("course_id") is not None
        ]
        if not course_ids:
            return courses

        instructor_rows = (
            supabase.table("users")
            .select("course_fk")
            .in_("course_fk", course_ids)
            .eq("active", True)
            .eq("role", "instructor")
            .execute()
            .data
            or []
        )
        instructor_counts: Dict[int, int] = {}
        for row in instructor_rows:
            course_fk = row.get("course_fk")
            if course_fk is None:
                continue
            course_id = int(course_fk)
            instructor_counts[course_id] = instructor_counts.get(course_id, 0) + 1

        current_term = self._current_marketplace_term()
        current_offerings_by_course: Dict[int, Dict[str, Any]] = {}
        offering_held_by_id: Dict[int, List[Dict[str, Any]]] = {}
        held_courses_by_id: Dict[int, Dict[str, Any]] = {}
        offering_ecosystem_ids: set[int] = set()
        if current_term:
            offering_rows = (
                supabase.table("course_offerings")
                .select("*")
                .in_("course_fk", course_ids)
                .eq("term", current_term)
                .neq("status", "archived")
                .execute()
                .data
                or []
            )
            status_rank = {"active": 0, "draft": 1, "inactive": 2}
            for row in offering_rows:
                course_fk = row.get("course_fk")
                if course_fk is None:
                    continue
                ecosystem_fk = row.get("ecosystem_fk")
                if ecosystem_fk is not None:
                    offering_ecosystem_ids.add(int(ecosystem_fk))
                course_id = int(course_fk)
                existing = current_offerings_by_course.get(course_id)
                if existing is None:
                    current_offerings_by_course[course_id] = row
                    continue
                row_rank = status_rank.get(str(row.get("status") or ""), 99)
                existing_rank = status_rank.get(str(existing.get("status") or ""), 99)
                if (
                    row_rank < existing_rank
                    or (
                        row_rank == existing_rank
                        and int(row.get("course_offering_id") or 0) > int(existing.get("course_offering_id") or 0)
                    )
                ):
                    current_offerings_by_course[course_id] = row

            offering_ids = [
                int(row["course_offering_id"])
                for row in current_offerings_by_course.values()
                if row.get("course_offering_id") is not None
            ]
            if offering_ids:
                held_rows = (
                    supabase.table("course_offering_held_with")
                    .select("*")
                    .in_("course_offering_fk", offering_ids)
                    .execute()
                    .data
                    or []
                )
                held_course_ids = sorted({
                    row.get("held_with_course_fk")
                    for row in held_rows
                    if row.get("held_with_course_fk") is not None
                })
                if held_course_ids:
                    held_course_rows = (
                        supabase.table("courses")
                        .select("course_id,code,name,active,active_terms,activation_mode,department_fk,ecosystem_fk,routing_kind,requires_project_support,retired_for_routing")
                        .in_("course_id", held_course_ids)
                        .execute()
                        .data
                        or []
                    )
                    held_courses_by_id = {
                        int(row["course_id"]): row
                        for row in held_course_rows
                        if row.get("course_id") is not None
                    }
                for row in held_rows:
                    offering_fk = row.get("course_offering_fk")
                    held_course_fk = row.get("held_with_course_fk")
                    if offering_fk is None or held_course_fk is None:
                        continue
                    held_course = held_courses_by_id.get(int(held_course_fk))
                    offering_held_by_id.setdefault(int(offering_fk), []).append({
                        **row,
                        "course": held_course,
                        "held_with_course": held_course,
                    })

        department_ids = sorted({
            course.get("department_fk")
            for course in courses
            if course.get("department_fk") is not None
        })
        ecosystem_ids = sorted({
            course.get("ecosystem_fk")
            for course in courses
            if course.get("ecosystem_fk") is not None
        } | offering_ecosystem_ids)
        global_phase = self._current_marketplace_phase()
        departments_by_id: Dict[int, Dict[str, Any]] = {}
        if department_ids:
            departments = (
                supabase.table("departments")
                .select("department_id,name,active,faculty_fk")
                .in_("department_id", department_ids)
                .execute()
                .data
                or []
            )
            departments_by_id = {
                int(department["department_id"]): department
                for department in departments
                if department.get("department_id") is not None
            }
        ecosystems_by_id: Dict[int, Dict[str, Any]] = {}
        if ecosystem_ids:
            ecosystems = (
                supabase.table("project_ecosystems")
                .select("ecosystem_id,name,description,active,marketplace_phase_override,marketplace_phase_override_reason,marketplace_phase_override_updated_by_fk,marketplace_phase_override_updated_at")
                .in_("ecosystem_id", ecosystem_ids)
                .execute()
                .data
                or []
            )
            ecosystems_by_id = {
                int(ecosystem["ecosystem_id"]): ecosystem
                for ecosystem in ecosystems
                if ecosystem.get("ecosystem_id") is not None
            }

        edge_rows = (
            supabase.table("course_pipeline_edges")
            .select("*")
            .in_("from_course_fk", course_ids)
            .order("is_default", desc=True)
            .order("course_pipeline_edge_id")
            .execute()
            .data
            or []
        )
        target_course_ids = sorted({
            edge.get("to_course_fk")
            for edge in edge_rows
            if edge.get("to_course_fk") is not None
        })
        missing_instructor_course_ids = sorted(set(target_course_ids) - set(course_ids))
        if missing_instructor_course_ids:
            target_instructor_rows = (
                supabase.table("users")
                .select("course_fk")
                .in_("course_fk", missing_instructor_course_ids)
                .eq("active", True)
                .eq("role", "instructor")
                .execute()
                .data
                or []
            )
            for row in target_instructor_rows:
                course_fk = row.get("course_fk")
                if course_fk is None:
                    continue
                course_id = int(course_fk)
                instructor_counts[course_id] = instructor_counts.get(course_id, 0) + 1
        pipeline_target_rows: list[Dict[str, Any]] = []
        if target_course_ids:
            pipeline_target_rows = (
                supabase.table("courses")
                .select("*")
                .in_("course_id", target_course_ids)
                .execute()
                .data
                or []
            )
        all_department_ids = sorted({
            course.get("department_fk")
            for course in pipeline_target_rows
            if course.get("department_fk") is not None
        } | set(department_ids))
        all_ecosystem_ids = sorted({
            course.get("ecosystem_fk")
            for course in pipeline_target_rows
            if course.get("ecosystem_fk") is not None
        } | set(ecosystem_ids))
        if all_department_ids and len(all_department_ids) > len(departments_by_id):
            departments = (
                supabase.table("departments")
                .select("department_id,name,active,faculty_fk")
                .in_("department_id", all_department_ids)
                .execute()
                .data
                or []
            )
            departments_by_id = {
                int(department["department_id"]): department
                for department in departments
                if department.get("department_id") is not None
            }
        if all_ecosystem_ids and len(all_ecosystem_ids) > len(ecosystems_by_id):
            ecosystems = (
                supabase.table("project_ecosystems")
                .select("ecosystem_id,name,description,active,marketplace_phase_override,marketplace_phase_override_reason,marketplace_phase_override_updated_by_fk,marketplace_phase_override_updated_at")
                .in_("ecosystem_id", all_ecosystem_ids)
                .execute()
                .data
                or []
            )
            ecosystems_by_id = {
                int(ecosystem["ecosystem_id"]): ecosystem
                for ecosystem in ecosystems
                if ecosystem.get("ecosystem_id") is not None
            }

        faculty_ids = sorted({
            department.get("faculty_fk")
            for department in departments_by_id.values()
            if department.get("faculty_fk") is not None
        })
        faculties_by_id: Dict[int, Dict[str, Any]] = {}
        if faculty_ids:
            faculties = (
                supabase.table("faculties")
                .select("faculty_id,name,active")
                .in_("faculty_id", faculty_ids)
                .execute()
                .data
                or []
            )
            faculties_by_id = {
                int(faculty["faculty_id"]): faculty
                for faculty in faculties
                if faculty.get("faculty_id") is not None
            }
        for department in departments_by_id.values():
            faculty_fk = department.get("faculty_fk")
            department["faculty"] = (
                faculties_by_id.get(int(faculty_fk))
                if faculty_fk is not None
                else None
            )

        def course_summary(course: Dict[str, Any]) -> Dict[str, Any]:
            course_id = int(course["course_id"])
            department_fk = course.get("department_fk")
            department = (
                departments_by_id.get(int(department_fk))
                if department_fk is not None
                else None
            )
            ecosystem_fk = course.get("ecosystem_fk")
            ecosystem = (
                ecosystems_by_id.get(int(ecosystem_fk))
                if ecosystem_fk is not None
                else None
            )
            current_offering = current_offerings_by_course.get(course_id)
            effective_offering = (
                current_offering
                if current_offering
                and str(current_offering.get("status") or "").lower() == "active"
                else None
            )
            active_instructor_count = instructor_counts.get(course_id, 0)
            target_season = (
                current_term.split(" ", 1)[0]
                if current_term and " " in current_term
                else None
            )
            retired_for_routing = course.get("retired_for_routing") is True
            activation_mode = course.get("activation_mode") or "auto"
            active_terms = course.get("active_terms") or []
            if retired_for_routing or activation_mode == "force_inactive":
                active_for_current_term = False
            elif current_offering:
                active_for_current_term = effective_offering is not None
            elif activation_mode == "force_active":
                active_for_current_term = True
            elif not target_season:
                active_for_current_term = course.get("active") is not False
            else:
                active_for_current_term = bool(
                    target_season
                    and any(str(term) == target_season for term in active_terms)
                )
            available_for_current_term = active_for_current_term and active_instructor_count > 0
            offering_ecosystem_fk = (
                current_offering.get("ecosystem_fk")
                if current_offering
                else None
            )
            active_offering_ecosystem_fk = (
                effective_offering.get("ecosystem_fk")
                if effective_offering
                else None
            )
            effective_ecosystem_fk = (
                active_offering_ecosystem_fk
                if active_offering_ecosystem_fk is not None
                else ecosystem_fk
            )
            offering_ecosystem = (
                ecosystems_by_id.get(int(offering_ecosystem_fk))
                if offering_ecosystem_fk is not None
                else None
            )
            effective_ecosystem = (
                ecosystems_by_id.get(int(effective_ecosystem_fk))
                if effective_ecosystem_fk is not None
                else None
            )
            routing_kind = course.get("routing_kind") or "standard"
            effective_routing_kind = (
                effective_offering.get("routing_kind_override")
                if effective_offering and effective_offering.get("routing_kind_override")
                else routing_kind
            )
            effective_requires_project_support = (
                effective_offering.get("requires_project_support")
                if effective_offering and effective_offering.get("requires_project_support") is not None
                else course.get("requires_project_support")
            )
            is_interdisciplinary = effective_routing_kind == "interdisciplinary"
            phase_context = self._phase_context_for_course(
                {**course, "routing_kind": effective_routing_kind},
                effective_ecosystem,
                global_phase,
            )
            offering_payload = None
            if current_offering:
                offering_id = int(current_offering["course_offering_id"])
                offering_payload = {
                    **current_offering,
                    "ecosystem": offering_ecosystem,
                    "held_with": offering_held_by_id.get(offering_id, []),
                    "held_with_courses": [
                        row.get("held_with_course")
                        for row in offering_held_by_id.get(offering_id, [])
                        if row.get("held_with_course") is not None
                    ],
                }
            return {
                **course,
                "stored_active": course.get("active"),
                "active": active_for_current_term,
                "active_for_current_term": active_for_current_term,
                "available_for_current_term": available_for_current_term,
                "department_id": department_fk,
                "department": department,
                "ecosystem_id": ecosystem_fk,
                "ecosystem": ecosystem,
                "current_marketplace_term": current_term,
                "current_offering": offering_payload,
                "offering_status": current_offering.get("status") if current_offering else None,
                "effective_title": (
                    effective_offering.get("title_override")
                    if effective_offering and effective_offering.get("title_override")
                    else course.get("name")
                ),
                "effective_name": (
                    effective_offering.get("title_override")
                    if effective_offering and effective_offering.get("title_override")
                    else course.get("name")
                ),
                "effective_topic": effective_offering.get("topic") if effective_offering else None,
                "effective_description": effective_offering.get("description") if effective_offering else None,
                "effective_routing_kind": effective_routing_kind,
                "effective_ecosystem_id": effective_ecosystem_fk,
                "effective_ecosystem": effective_ecosystem,
                "effective_requires_project_support": effective_requires_project_support,
                "effective_marketplace_phase": phase_context["effective_phase"],
                "marketplace_phase_context": phase_context,
                "can_set_course_phase_override": not is_interdisciplinary and not retired_for_routing,
                "active_instructor_count": active_instructor_count,
                "retired_for_routing": retired_for_routing,
            }

        target_courses_by_id = {
            int(course["course_id"]): course_summary(course)
            for course in pipeline_target_rows
            if course.get("course_id") is not None
        }
        edges_by_source: Dict[int, list[Dict[str, Any]]] = {}
        for edge in edge_rows:
            from_course_fk = edge.get("from_course_fk")
            to_course_fk = edge.get("to_course_fk")
            if from_course_fk is None or to_course_fk is None:
                continue
            target_course = target_courses_by_id.get(int(to_course_fk))
            normalized_edge = {
                **edge,
                "course": target_course,
                "to_course": target_course,
            }
            edges_by_source.setdefault(int(from_course_fk), []).append(normalized_edge)

        enriched = []
        for course in courses:
            course_id = int(course["course_id"])
            pipeline_edges = edges_by_source.get(course_id, [])
            default_edge = next(
                (edge for edge in pipeline_edges if edge.get("active") is not False and edge.get("is_default") is True),
                None,
            )
            enriched.append({
                **course_summary(course),
                "pipeline_next_courses": pipeline_edges,
                "default_pipeline_course_id": default_edge.get("to_course_fk") if default_edge else None,
            })
        return enriched

    def _enrich_course_offerings(self, offerings: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        if not offerings:
            return offerings

        offering_ids = [
            int(offering["course_offering_id"])
            for offering in offerings
            if offering.get("course_offering_id") is not None
        ]
        course_ids = {
            offering.get("course_fk")
            for offering in offerings
            if offering.get("course_fk") is not None
        }

        held_rows: list[Dict[str, Any]] = []
        if offering_ids:
            held_rows = (
                supabase.table("course_offering_held_with")
                .select("*")
                .in_("course_offering_fk", offering_ids)
                .execute()
                .data
                or []
            )
            course_ids.update(
                row.get("held_with_course_fk")
                for row in held_rows
                if row.get("held_with_course_fk") is not None
            )

        course_rows: list[Dict[str, Any]] = []
        if course_ids:
            course_rows = (
                supabase.table("courses")
                .select("*")
                .in_("course_id", sorted(course_ids))
                .execute()
                .data
                or []
            )
        courses_by_id = {
            int(course["course_id"]): course
            for course in self._enrich_courses(course_rows)
            if course.get("course_id") is not None
        }

        ecosystem_ids = {
            offering.get("ecosystem_fk")
            for offering in offerings
            if offering.get("ecosystem_fk") is not None
        }
        ecosystem_rows: list[Dict[str, Any]] = []
        if ecosystem_ids:
            ecosystem_rows = (
                supabase.table("project_ecosystems")
                .select("ecosystem_id,name,description,active,marketplace_phase_override,marketplace_phase_override_reason,marketplace_phase_override_updated_by_fk,marketplace_phase_override_updated_at")
                .in_("ecosystem_id", sorted(ecosystem_ids))
                .execute()
                .data
                or []
            )
        ecosystems_by_id = {
            int(ecosystem["ecosystem_id"]): ecosystem
            for ecosystem in ecosystem_rows
            if ecosystem.get("ecosystem_id") is not None
        }

        held_by_offering: Dict[int, List[Dict[str, Any]]] = {}
        for row in held_rows:
            offering_fk = row.get("course_offering_fk")
            held_course_fk = row.get("held_with_course_fk")
            if offering_fk is None or held_course_fk is None:
                continue
            held_course = courses_by_id.get(int(held_course_fk))
            held_by_offering.setdefault(int(offering_fk), []).append({
                **row,
                "course": held_course,
                "held_with_course": held_course,
            })

        enriched: list[Dict[str, Any]] = []
        for offering in offerings:
            course_fk = offering.get("course_fk")
            ecosystem_fk = offering.get("ecosystem_fk")
            offering_id = int(offering["course_offering_id"])
            held_with = held_by_offering.get(offering_id, [])
            enriched.append({
                **offering,
                "course": courses_by_id.get(int(course_fk)) if course_fk is not None else None,
                "ecosystem_id": ecosystem_fk,
                "ecosystem": ecosystems_by_id.get(int(ecosystem_fk)) if ecosystem_fk is not None else None,
                "held_with": held_with,
                "held_with_course_ids": [
                    row.get("held_with_course_fk")
                    for row in held_with
                    if row.get("held_with_course_fk") is not None
                ],
                "held_with_courses": [
                    row.get("held_with_course")
                    for row in held_with
                    if row.get("held_with_course") is not None
                ],
            })
        return enriched

    def list_course_offerings(
        self,
        term: Optional[str] = None,
        course_id: Optional[int] = None,
    ) -> list[Dict[str, Any]]:
        query = supabase.table("course_offerings").select("*")
        if term:
            query = query.eq("term", term)
        if course_id:
            query = query.eq("course_fk", course_id)
        response = query.order("term", desc=True).order("course_fk").order("course_offering_id").execute()
        return self._enrich_course_offerings(response.data or [])

    def list_courses(self, active_only: bool = False) -> list[Dict[str, Any]]:
        query = supabase.table(self.table_name).select("*").order("code")
        if active_only:
            query = query.neq("retired_for_routing", True)
        response = query.execute()
        courses = self._enrich_courses(response.data or [])
        if active_only:
            return [
                course
                for course in courses
                if course.get("active_for_current_term") is True
                and course.get("retired_for_routing") is not True
            ]
        return courses

    def list_project_ecosystems(self, active_only: bool = False) -> list[Dict[str, Any]]:
        query = supabase.table("project_ecosystems").select("*").order("name")
        if active_only:
            query = query.eq("active", True)
        response = query.execute()
        global_phase = self._current_marketplace_phase()
        rows = []
        for row in response.data or []:
            rows.append({
                **row,
                "effective_marketplace_phase": self._phase_context_for_ecosystem(row, global_phase)["effective_phase"],
                "marketplace_phase_context": self._phase_context_for_ecosystem(row, global_phase),
                "can_set_ecosystem_phase_override": (
                    row.get("active") is True
                    and str(row.get("name") or "").lower() != "departmental"
                ),
            })
        return rows

    def get_project_ecosystem_by_id(self, ecosystem_id: int) -> Optional[Dict[str, Any]]:
        response = (
            supabase.table("project_ecosystems")
            .select("*")
            .eq("ecosystem_id", ecosystem_id)
            .execute()
        )
        if not response.data:
            return None
        return response.data[0]

    def get_course_by_id(self, course_id: int) -> Optional[Dict[str, Any]]:
        response = supabase.table(self.table_name).select(
            "*").eq("course_id", course_id).execute()
        if not response.data:
            return None
        return self._enrich_courses([response.data[0]])[0]

