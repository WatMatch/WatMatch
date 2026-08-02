import re
from typing import Dict, Any, Optional, List
from .courses_dl import CoursesDataLogic


COURSE_SEASONS = ("Winter", "Spring", "Fall")
ACTIVATION_MODES = {"auto", "force_active", "force_inactive"}
ROUTING_KINDS = {"standard", "interdisciplinary"}
MARKETPLACE_PHASES = {"exploration", "commitment", "finalization"}
OFFERING_STATUSES = {"draft", "active", "inactive", "archived"}
CLONE_OFFERING_STATUSES = {"draft", "active", "inactive"}
TERM_PATTERN = re.compile(r"^(Winter|Spring|Fall) [0-9]{4}$")


class CoursesBusinessLogic:
    def __init__(self) -> None:
        self.courses_data = CoursesDataLogic()

    def _normalize_active_terms(self, active_terms: Optional[List[str]]) -> List[str]:
        if active_terms is None:
            return []
        seen = set()
        normalized: List[str] = []
        for value in active_terms:
            season = (value or "").strip()
            if season not in COURSE_SEASONS:
                raise ValueError("Active terms must be Winter, Spring, and/or Fall.")
            if season not in seen:
                seen.add(season)
                normalized.append(season)
        return [season for season in COURSE_SEASONS if season in seen]

    def _normalize_activation_mode(self, activation_mode: Optional[str]) -> str:
        normalized = (activation_mode or "auto").strip().lower()
        if normalized not in ACTIVATION_MODES:
            raise ValueError("Activation mode must be auto, force_active, or force_inactive.")
        return normalized

    def _normalize_routing_kind(self, routing_kind: Optional[str]) -> str:
        normalized = (routing_kind or "standard").strip().lower()
        if normalized not in ROUTING_KINDS:
            raise ValueError("Routing kind must be standard or interdisciplinary.")
        return normalized

    def _normalize_optional_routing_kind(self, routing_kind: Optional[str]) -> Optional[str]:
        if routing_kind is None:
            return None
        normalized = routing_kind.strip().lower()
        if not normalized:
            return None
        if normalized not in ROUTING_KINDS:
            raise ValueError("Routing kind override must be standard or interdisciplinary.")
        return normalized

    def _normalize_offering_status(self, status: Optional[str]) -> str:
        normalized = (status or "draft").strip().lower()
        if normalized not in OFFERING_STATUSES:
            raise ValueError("Offering status must be draft, active, inactive, or archived.")
        return normalized

    def _normalize_marketplace_phase_override(self, phase: Optional[str]) -> Optional[str]:
        if phase is None:
            return None
        normalized = phase.strip().lower()
        if normalized == "":
            return None
        if normalized == "locked":
            return "finalization"
        if normalized not in MARKETPLACE_PHASES:
            raise ValueError("Marketplace phase override must be exploration, commitment, or finalization.")
        return normalized

    def create_course(
        self,
        code: str,
        name: str,
        active_terms: Optional[List[str]],
        activation_mode: Optional[str],
        department_id: Optional[int],
        ecosystem_id: Optional[int],
        routing_kind: Optional[str],
        marketplace_phase_override: Optional[str],
        marketplace_phase_override_reason: Optional[str],
        requires_project_support: bool,
        actor_id: int,
    ) -> Dict[str, Any]:
        if not code or not code.strip():
            return {"success": False, "message": "Course code is required", "data": None}
        if not name or not name.strip():
            return {"success": False, "message": "Course name is required", "data": None}
        try:
            normalized_active_terms = self._normalize_active_terms(active_terms)
            normalized_activation_mode = self._normalize_activation_mode(activation_mode)
            normalized_routing_kind = self._normalize_routing_kind(routing_kind)
            normalized_phase_override = self._normalize_marketplace_phase_override(
                marketplace_phase_override
            )
        except ValueError as exc:
            return {"success": False, "message": str(exc), "data": None}

        payload = {
            "code": code.strip().upper(),
            "name": name.strip(),
            "active_terms": normalized_active_terms,
            "activation_mode": normalized_activation_mode,
            "department_id": department_id,
            "ecosystem_id": ecosystem_id,
            "routing_kind": normalized_routing_kind,
            "marketplace_phase_override": normalized_phase_override,
            "marketplace_phase_override_reason": (
                marketplace_phase_override_reason.strip()
                if isinstance(marketplace_phase_override_reason, str)
                and marketplace_phase_override_reason.strip()
                else None
            ),
            "requires_project_support": requires_project_support is not False,
        }

        try:
            return self.courses_data.upsert_course_rpc(
                course_id=None,
                code=payload["code"],
                name=payload["name"],
                active_terms=payload["active_terms"],
                activation_mode=payload["activation_mode"],
                department_id=payload["department_id"],
                ecosystem_id=payload["ecosystem_id"],
                routing_kind=payload["routing_kind"],
                marketplace_phase_override=payload["marketplace_phase_override"],
                marketplace_phase_override_reason=payload["marketplace_phase_override_reason"],
                requires_project_support=payload["requires_project_support"],
                actor_id=actor_id,
                reason="admin_course_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def list_courses(self, active_only: bool) -> Dict[str, Any]:
        try:
            rows = self.courses_data.list_courses(active_only=active_only)
            return {"success": True, "message": f"Retrieved {len(rows)} course(s)", "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def list_project_ecosystems(self, active_only: bool = False) -> Dict[str, Any]:
        try:
            rows = self.courses_data.list_project_ecosystems(active_only=active_only)
            return {"success": True, "message": f"Retrieved {len(rows)} project ecosystem(s)", "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def list_course_offerings(
        self,
        term: Optional[str] = None,
        course_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            rows = self.courses_data.list_course_offerings(
                term=term.strip() if isinstance(term, str) and term.strip() else None,
                course_id=course_id,
            )
            return {"success": True, "message": f"Retrieved {len(rows)} course offering(s)", "data": rows}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def clone_course_offerings(
        self,
        source_term: str,
        target_term: str,
        target_status: Optional[str],
        overwrite_existing: bool,
        actor_id: int,
        reason: Optional[str],
    ) -> Dict[str, Any]:
        normalized_source_term = (source_term or "").strip()
        normalized_target_term = (target_term or "").strip()
        normalized_status = (target_status or "draft").strip().lower()
        if not TERM_PATTERN.match(normalized_source_term):
            return {
                "success": False,
                "message": "Source term must look like Winter 2026, Spring 2026, or Fall 2026.",
                "data": None,
            }
        if not TERM_PATTERN.match(normalized_target_term):
            return {
                "success": False,
                "message": "Target term must look like Winter 2026, Spring 2026, or Fall 2026.",
                "data": None,
            }
        if normalized_source_term == normalized_target_term:
            return {"success": False, "message": "Source and target terms must be different.", "data": None}
        if normalized_status not in CLONE_OFFERING_STATUSES:
            return {
                "success": False,
                "message": "Cloned offerings can be created as draft, active, or inactive.",
                "data": None,
            }

        try:
            return self.courses_data.clone_course_offerings_rpc(
                source_term=normalized_source_term,
                target_term=normalized_target_term,
                target_status=normalized_status,
                overwrite_existing=overwrite_existing is True,
                actor_id=actor_id,
                reason=reason.strip() if isinstance(reason, str) and reason.strip() else "admin_course_offering_clone",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def get_course(self, course_id: int) -> Dict[str, Any]:
        if course_id <= 0:
            return {"success": False, "message": "Invalid course_id", "data": None}
        try:
            row = self.courses_data.get_course_by_id(course_id)
            if not row:
                return {"success": False, "message": "Course not found", "data": None}
            return {"success": True, "message": "Course retrieved", "data": row}
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def update_course(
        self,
        course_id: int,
        code: Optional[str],
        name: Optional[str],
        active_terms: Optional[List[str]],
        activation_mode: Optional[str],
        department_id: Optional[int],
        department_id_supplied: bool,
        ecosystem_id: Optional[int],
        ecosystem_id_supplied: bool,
        routing_kind: Optional[str],
        marketplace_phase_override: Optional[str],
        marketplace_phase_override_supplied: bool,
        marketplace_phase_override_reason: Optional[str],
        marketplace_phase_override_reason_supplied: bool,
        requires_project_support: Optional[bool],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if course_id <= 0:
            return {"success": False, "message": "Invalid course_id", "data": None}

        existing = self.courses_data.get_course_by_id(course_id)
        if not existing:
            return {"success": False, "message": "Course not found", "data": None}

        payload: Dict[str, Any] = {
            "code": existing.get("code"),
            "name": existing.get("name"),
            "active_terms": existing.get("active_terms") or [],
            "activation_mode": existing.get("activation_mode") or "auto",
            "department_id": existing.get("department_id") or existing.get("department_fk"),
            "ecosystem_id": existing.get("ecosystem_id") or existing.get("ecosystem_fk"),
            "routing_kind": existing.get("routing_kind") or "standard",
            "marketplace_phase_override": existing.get("marketplace_phase_override"),
            "marketplace_phase_override_reason": existing.get("marketplace_phase_override_reason"),
            "requires_project_support": existing.get("requires_project_support") is not False,
        }
        if code is not None:
            if not code.strip():
                return {"success": False, "message": "Course code is required", "data": None}
            payload["code"] = code.strip().upper()
        if name is not None:
            if not name.strip():
                return {"success": False, "message": "Course name is required", "data": None}
            payload["name"] = name.strip()
        if active_terms is not None:
            try:
                payload["active_terms"] = self._normalize_active_terms(active_terms)
            except ValueError as exc:
                return {"success": False, "message": str(exc), "data": None}
        if activation_mode is not None:
            try:
                payload["activation_mode"] = self._normalize_activation_mode(activation_mode)
            except ValueError as exc:
                return {"success": False, "message": str(exc), "data": None}
        if department_id_supplied:
            payload["department_id"] = department_id
        if ecosystem_id_supplied:
            payload["ecosystem_id"] = ecosystem_id
        if routing_kind is not None:
            try:
                payload["routing_kind"] = self._normalize_routing_kind(routing_kind)
            except ValueError as exc:
                return {"success": False, "message": str(exc), "data": None}
        if marketplace_phase_override_supplied:
            try:
                payload["marketplace_phase_override"] = self._normalize_marketplace_phase_override(
                    marketplace_phase_override
                )
            except ValueError as exc:
                return {"success": False, "message": str(exc), "data": None}
        if marketplace_phase_override_reason_supplied:
            payload["marketplace_phase_override_reason"] = (
                marketplace_phase_override_reason.strip()
                if isinstance(marketplace_phase_override_reason, str)
                and marketplace_phase_override_reason.strip()
                else None
            )
        if requires_project_support is not None:
            payload["requires_project_support"] = requires_project_support
        normalized_reason = (
            reason.strip()
            if isinstance(reason, str) and reason.strip()
            else None
        )
        is_forcing_inactive = (
            str(existing.get("activation_mode") or "auto").strip().lower()
            != "force_inactive"
            and payload["activation_mode"] == "force_inactive"
        )
        if is_forcing_inactive and normalized_reason is None:
            return {
                "success": False,
                "message": "Forcing a course inactive requires an audit reason.",
                "data": None,
            }
        try:
            return self.courses_data.upsert_course_rpc(
                course_id=course_id,
                code=payload["code"],
                name=payload["name"],
                active_terms=payload["active_terms"],
                activation_mode=payload["activation_mode"],
                department_id=payload["department_id"],
                ecosystem_id=payload["ecosystem_id"],
                routing_kind=payload["routing_kind"],
                marketplace_phase_override=payload["marketplace_phase_override"],
                marketplace_phase_override_reason=payload["marketplace_phase_override_reason"],
                requires_project_support=payload["requires_project_support"],
                actor_id=actor_id,
                reason=normalized_reason or "admin_course_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def upsert_course_offering(
        self,
        offering_id: Optional[int],
        course_id: int,
        term: str,
        title_override: Optional[str],
        description: Optional[str],
        topic: Optional[str],
        section_label: Optional[str],
        status: Optional[str],
        routing_kind_override: Optional[str],
        ecosystem_id: Optional[int],
        requires_project_support: Optional[bool],
        student_registration_notes: Optional[str],
        admin_routing_notes: Optional[str],
        source_url: Optional[str],
        held_with_course_ids: Optional[List[int]],
        actor_id: int,
    ) -> Dict[str, Any]:
        if course_id <= 0:
            return {"success": False, "message": "Course is required.", "data": None}
        if offering_id is not None and offering_id <= 0:
            return {"success": False, "message": "Invalid course offering.", "data": None}
        if not term or not term.strip():
            return {"success": False, "message": "Offering term is required.", "data": None}
        try:
            normalized_status = self._normalize_offering_status(status)
            normalized_routing_override = self._normalize_optional_routing_kind(routing_kind_override)
        except ValueError as exc:
            return {"success": False, "message": str(exc), "data": None}

        normalized_held_with: List[int] = []
        seen: set[int] = set()
        for value in held_with_course_ids or []:
            try:
                parsed = int(value)
            except (TypeError, ValueError):
                return {"success": False, "message": "Held-with course IDs must be numeric.", "data": None}
            if parsed <= 0 or parsed == course_id or parsed in seen:
                continue
            seen.add(parsed)
            normalized_held_with.append(parsed)

        try:
            return self.courses_data.upsert_course_offering_rpc(
                offering_id=offering_id,
                course_id=course_id,
                term=term.strip(),
                title_override=title_override.strip() if isinstance(title_override, str) and title_override.strip() else None,
                description=description.strip() if isinstance(description, str) and description.strip() else None,
                topic=topic.strip() if isinstance(topic, str) and topic.strip() else None,
                section_label=section_label.strip() if isinstance(section_label, str) and section_label.strip() else None,
                status=normalized_status,
                routing_kind_override=normalized_routing_override,
                ecosystem_id=ecosystem_id,
                requires_project_support=requires_project_support,
                student_registration_notes=(
                    student_registration_notes.strip()
                    if isinstance(student_registration_notes, str) and student_registration_notes.strip()
                    else None
                ),
                admin_routing_notes=(
                    admin_routing_notes.strip()
                    if isinstance(admin_routing_notes, str) and admin_routing_notes.strip()
                    else None
                ),
                source_url=source_url.strip() if isinstance(source_url, str) and source_url.strip() else None,
                held_with_course_ids=normalized_held_with,
                actor_id=actor_id,
                reason="admin_course_offering_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def update_project_ecosystem(
        self,
        ecosystem_id: int,
        description: Optional[str],
        active: Optional[bool],
        marketplace_phase_override: Optional[str],
        marketplace_phase_override_reason: Optional[str],
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if ecosystem_id <= 0:
            return {"success": False, "message": "Invalid ecosystem_id", "data": None}
        try:
            existing = self.courses_data.get_project_ecosystem_by_id(ecosystem_id)
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}
        if not existing:
            return {"success": False, "message": "Project ecosystem not found", "data": None}
        normalized_reason = (
            reason.strip()
            if isinstance(reason, str) and reason.strip()
            else None
        )
        if existing.get("active") is not False and active is False and normalized_reason is None:
            return {
                "success": False,
                "message": "Project ecosystem deactivation requires an audit reason.",
                "data": None,
            }
        try:
            normalized_phase_override = self._normalize_marketplace_phase_override(
                marketplace_phase_override
            )
        except ValueError as exc:
            return {"success": False, "message": str(exc), "data": None}
        try:
            return self.courses_data.update_project_ecosystem_rpc(
                ecosystem_id=ecosystem_id,
                description=description.strip() if isinstance(description, str) and description.strip() else None,
                active=active if active is not None else None,
                marketplace_phase_override=normalized_phase_override,
                marketplace_phase_override_reason=(
                    marketplace_phase_override_reason.strip()
                    if isinstance(marketplace_phase_override_reason, str)
                    and marketplace_phase_override_reason.strip()
                    else None
                ),
                actor_id=actor_id,
                reason=normalized_reason or "admin_project_ecosystem_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}

    def upsert_pipeline_edge(
        self,
        edge_id: Optional[int],
        from_course_id: int,
        to_course_id: int,
        active: bool,
        is_default: bool,
        notes: Optional[str],
        actor_id: int,
    ) -> Dict[str, Any]:
        if from_course_id <= 0 or to_course_id <= 0:
            return {"success": False, "message": "Source and target courses are required.", "data": None}
        if notes and len(notes.strip()) > 1000:
            return {"success": False, "message": "Pipeline notes must be 1000 characters or fewer.", "data": None}
        try:
            return self.courses_data.upsert_pipeline_edge_rpc(
                edge_id=edge_id,
                from_course_id=from_course_id,
                to_course_id=to_course_id,
                active=active is not False,
                is_default=is_default is True,
                notes=notes.strip() if notes and notes.strip() else None,
                actor_id=actor_id,
                reason="admin_course_pipeline_management",
            )
        except Exception as e:
            return {"success": False, "message": str(e), "data": None}
