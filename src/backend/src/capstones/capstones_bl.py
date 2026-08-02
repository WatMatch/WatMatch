import csv
import io
import logging

from .capstones_dl import CapstonesDataLogic
from typing import Dict, Any, Optional
from ..config.database import supabase
from ..mailer.mailer import send_capstone_approval_email, send_capstone_rejection_email, send_capstone_changes_email
from ..workflow.workflow_utils import (
    get_team_member_ids,
)

logger = logging.getLogger(__name__)


class CapstonesBusinessLogic:
    """Business layer for capstone operations"""

    def __init__(self):
        self.capstones_data = CapstonesDataLogic()

    def _build_capstone_payload(
        self,
        title: Optional[str] = None,
        description: Optional[str] = None,
        project_start_date: Optional[str] = None,
        project_disciplines: Optional[list[str]] = None,
        department_ids: Optional[list[int]] = None,
        skills_required: Optional[list[str]] = None,
        problem_area: Optional[str] = None,
        main_objectives: Optional[str] = None,
        scope_of_work: Optional[str] = None,
        deliverables: Optional[str] = None,
        meeting_frequency: Optional[str] = None,
        uw_resources: Optional[str] = None,
        org_resources: Optional[str] = None,
        other_resources: Optional[str] = None,
        how_heard_about_capstone: Optional[str] = None,
        deliverable_types: Optional[list[str]] = None,
        proposed_team_members: Optional[str] = None,
        success_criteria: Optional[str] = None,
        validation_plan: Optional[str] = None,
        stakeholders: Optional[str] = None,
        risks_constraints: Optional[str] = None,
        public_evaluation_acknowledged: bool = False,
        ip_acknowledged: bool = False,
        confidentiality_acknowledged: bool = False,
        ecosystem_id: Optional[int] = None,
        organization_name: Optional[str] = None,
        primary_contact: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        website: Optional[str] = None,
        organization_description: Optional[str] = None,
        organization_size: Optional[str] = None,
        sector: Optional[str] = None,
        partner_opportunity_id: Optional[int] = None,
        external_partner_name: Optional[str] = None,
        external_partner_organization: Optional[str] = None,
        external_partner_email: Optional[str] = None,
        external_partner_website: Optional[str] = None,
        external_partner_notes: Optional[str] = None,
        external_partner_confirmed: bool = False,
        submission_track: str = "home_course",
        requested_course_id: Optional[int] = None,
        admin_finalization_override: bool = False,
        admin_finalization_override_actor_id: Optional[int] = None,
        admin_finalization_override_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        return {
            "title": title.strip() if isinstance(title, str) else title,
            "description": description.strip() if isinstance(description, str) else description,
            "project_start_date": project_start_date,
            "disciplines": project_disciplines or [],
            "department_ids": department_ids or [],
            "skills": skills_required or [],
            "problem_area": problem_area,
            "main_objectives": main_objectives,
            "scope_of_work": scope_of_work,
            "deliverables": deliverables,
            "meeting_frequency": meeting_frequency or "weekly",
            "uw_resources": uw_resources,
            "org_resources": org_resources,
            "other_resources": other_resources,
            "how_heard_about_capstone": how_heard_about_capstone,
            "deliverable_types": deliverable_types or [],
            "proposed_team_members": proposed_team_members,
            "success_criteria": success_criteria,
            "validation_plan": validation_plan,
            "stakeholders": stakeholders,
            "risks_constraints": risks_constraints,
            "public_evaluation_acknowledged": public_evaluation_acknowledged is True,
            "ip_acknowledged": ip_acknowledged is True,
            "confidentiality_acknowledged": confidentiality_acknowledged is True,
            "ecosystem_id": ecosystem_id,
            "organization_name": organization_name,
            "primary_contact": primary_contact,
            "email": email,
            "phone": phone,
            "website": website,
            "organization_description": organization_description,
            "organization_size": organization_size,
            "sector": sector,
            "partner_opportunity_id": partner_opportunity_id,
            "external_partner_name": external_partner_name,
            "external_partner_organization": external_partner_organization,
            "external_partner_email": external_partner_email,
            "external_partner_website": external_partner_website,
            "external_partner_notes": external_partner_notes,
            "external_partner_confirmed": external_partner_confirmed,
            "submission_track": submission_track,
            "requested_course_id": requested_course_id,
            "admin_finalization_override": admin_finalization_override,
            "admin_finalization_override_actor_id": admin_finalization_override_actor_id,
            "admin_finalization_override_reason": (
                admin_finalization_override_reason.strip()
                if isinstance(admin_finalization_override_reason, str)
                else admin_finalization_override_reason
            ),
        }

    def create_capstone_with_team(
        self,
        user_id: int,
        title: str,
        course_id: int,
        description: str = None,
        project_start_date: Optional[str] = None,
        project_disciplines: Optional[list[str]] = None,
        department_ids: Optional[list[int]] = None,
        skills_required: Optional[list[str]] = None,
        problem_area: Optional[str] = None,
        main_objectives: Optional[str] = None,
        scope_of_work: Optional[str] = None,
        deliverables: Optional[str] = None,
        meeting_frequency: Optional[str] = None,
        uw_resources: Optional[str] = None,
        org_resources: Optional[str] = None,
        other_resources: Optional[str] = None,
        how_heard_about_capstone: Optional[str] = None,
        deliverable_types: Optional[list[str]] = None,
        proposed_team_members: Optional[str] = None,
        success_criteria: Optional[str] = None,
        validation_plan: Optional[str] = None,
        stakeholders: Optional[str] = None,
        risks_constraints: Optional[str] = None,
        public_evaluation_acknowledged: bool = False,
        ip_acknowledged: bool = False,
        confidentiality_acknowledged: bool = False,
        ecosystem_id: Optional[int] = None,
        organization_name: Optional[str] = None,
        primary_contact: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        website: Optional[str] = None,
        organization_description: Optional[str] = None,
        organization_size: Optional[str] = None,
        sector: Optional[str] = None,
        partner_opportunity_id: Optional[int] = None,
        external_partner_name: Optional[str] = None,
        external_partner_organization: Optional[str] = None,
        external_partner_email: Optional[str] = None,
        external_partner_website: Optional[str] = None,
        external_partner_notes: Optional[str] = None,
        external_partner_confirmed: bool = False,
        submission_track: str = "home_course",
        requested_course_id: Optional[int] = None,
        admin_finalization_override: bool = False,
        admin_finalization_override_actor_id: Optional[int] = None,
        admin_finalization_override_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create a capstone project and automatically create a team for the user"""
        try:

            # Validate inputs
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None
                }

            if not title or not title.strip():
                return {
                    "success": False,
                    "message": "Title is required and cannot be empty.",
                    "data": None
                }

            rpc_result = self.capstones_data.create_capstone_with_new_team_rpc(
                user_id=user_id,
                course_id=course_id,
                payload=self._build_capstone_payload(
                    title=title,
                    description=description,
                    project_start_date=project_start_date,
                    project_disciplines=project_disciplines,
                    department_ids=department_ids,
                    skills_required=skills_required,
                    problem_area=problem_area,
                    main_objectives=main_objectives,
                    scope_of_work=scope_of_work,
                    deliverables=deliverables,
                    meeting_frequency=meeting_frequency,
                    uw_resources=uw_resources,
                    org_resources=org_resources,
                    other_resources=other_resources,
                    how_heard_about_capstone=how_heard_about_capstone,
                    deliverable_types=deliverable_types,
                    proposed_team_members=proposed_team_members,
                    success_criteria=success_criteria,
                    validation_plan=validation_plan,
                    stakeholders=stakeholders,
                    risks_constraints=risks_constraints,
                    public_evaluation_acknowledged=public_evaluation_acknowledged,
                    ip_acknowledged=ip_acknowledged,
                    confidentiality_acknowledged=confidentiality_acknowledged,
                    ecosystem_id=ecosystem_id,
                    organization_name=organization_name,
                    primary_contact=primary_contact,
                    email=email,
                    phone=phone,
                    website=website,
                    organization_description=organization_description,
                    organization_size=organization_size,
                    sector=sector,
                    partner_opportunity_id=partner_opportunity_id,
                    external_partner_name=external_partner_name,
                    external_partner_organization=external_partner_organization,
                    external_partner_email=external_partner_email,
                    external_partner_website=external_partner_website,
                    external_partner_notes=external_partner_notes,
                    external_partner_confirmed=external_partner_confirmed,
                    submission_track=submission_track,
                    requested_course_id=requested_course_id,
                    admin_finalization_override=admin_finalization_override,
                    admin_finalization_override_actor_id=admin_finalization_override_actor_id,
                    admin_finalization_override_reason=admin_finalization_override_reason,
                ),
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Capstone creation failed."), "data": None}

            result_data = rpc_result.get("data") or {}
            if result_data.get("capstone"):
                result_data["capstone"] = self._process_capstone_data(result_data["capstone"])

            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone project and team created successfully"),
                "data": result_data,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def create_capstone_for_existing_team(
        self,
        user_id: int,
        team_id: int,
        course_id: int,
        title: str,
        description: str = None,
        project_start_date: Optional[str] = None,
        project_disciplines: Optional[list[str]] = None,
        department_ids: Optional[list[int]] = None,
        skills_required: Optional[list[str]] = None,
        problem_area: Optional[str] = None,
        main_objectives: Optional[str] = None,
        scope_of_work: Optional[str] = None,
        deliverables: Optional[str] = None,
        meeting_frequency: Optional[str] = None,
        uw_resources: Optional[str] = None,
        org_resources: Optional[str] = None,
        other_resources: Optional[str] = None,
        how_heard_about_capstone: Optional[str] = None,
        deliverable_types: Optional[list[str]] = None,
        proposed_team_members: Optional[str] = None,
        success_criteria: Optional[str] = None,
        validation_plan: Optional[str] = None,
        stakeholders: Optional[str] = None,
        risks_constraints: Optional[str] = None,
        public_evaluation_acknowledged: bool = False,
        ip_acknowledged: bool = False,
        confidentiality_acknowledged: bool = False,
        ecosystem_id: Optional[int] = None,
        organization_name: Optional[str] = None,
        primary_contact: Optional[str] = None,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        website: Optional[str] = None,
        organization_description: Optional[str] = None,
        organization_size: Optional[str] = None,
        sector: Optional[str] = None,
        partner_opportunity_id: Optional[int] = None,
        external_partner_name: Optional[str] = None,
        external_partner_organization: Optional[str] = None,
        external_partner_email: Optional[str] = None,
        external_partner_website: Optional[str] = None,
        external_partner_notes: Optional[str] = None,
        external_partner_confirmed: bool = False,
        submission_track: str = "home_course",
        requested_course_id: Optional[int] = None,
        admin_finalization_override: bool = False,
        admin_finalization_override_actor_id: Optional[int] = None,
        admin_finalization_override_reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Create exactly one capstone for an already-existing team without capstone."""
        try:
            if not isinstance(user_id, int) or user_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid user ID. Must be a positive integer.",
                    "data": None
                }
            if not isinstance(team_id, int) or team_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid team ID. Must be a positive integer.",
                    "data": None
                }
            if not title or not title.strip():
                return {
                    "success": False,
                    "message": "Title is required and cannot be empty.",
                    "data": None
                }

            rpc_result = self.capstones_data.create_capstone_for_existing_team_rpc(
                user_id=user_id,
                team_id=team_id,
                course_id=course_id,
                payload=self._build_capstone_payload(
                    title=title,
                    description=description,
                    project_start_date=project_start_date,
                    project_disciplines=project_disciplines,
                    department_ids=department_ids,
                    skills_required=skills_required,
                    problem_area=problem_area,
                    main_objectives=main_objectives,
                    scope_of_work=scope_of_work,
                    deliverables=deliverables,
                    meeting_frequency=meeting_frequency,
                    uw_resources=uw_resources,
                    org_resources=org_resources,
                    other_resources=other_resources,
                    how_heard_about_capstone=how_heard_about_capstone,
                    deliverable_types=deliverable_types,
                    proposed_team_members=proposed_team_members,
                    success_criteria=success_criteria,
                    validation_plan=validation_plan,
                    stakeholders=stakeholders,
                    risks_constraints=risks_constraints,
                    public_evaluation_acknowledged=public_evaluation_acknowledged,
                    ip_acknowledged=ip_acknowledged,
                    confidentiality_acknowledged=confidentiality_acknowledged,
                    ecosystem_id=ecosystem_id,
                    organization_name=organization_name,
                    primary_contact=primary_contact,
                    email=email,
                    phone=phone,
                    website=website,
                    organization_description=organization_description,
                    organization_size=organization_size,
                    sector=sector,
                    partner_opportunity_id=partner_opportunity_id,
                    external_partner_name=external_partner_name,
                    external_partner_organization=external_partner_organization,
                    external_partner_email=external_partner_email,
                    external_partner_website=external_partner_website,
                    external_partner_notes=external_partner_notes,
                    external_partner_confirmed=external_partner_confirmed,
                    submission_track=submission_track,
                    requested_course_id=requested_course_id,
                    admin_finalization_override=admin_finalization_override,
                    admin_finalization_override_actor_id=admin_finalization_override_actor_id,
                    admin_finalization_override_reason=admin_finalization_override_reason,
                ),
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Capstone creation failed."), "data": None}

            result_data = rpc_result.get("data") or {}
            if result_data.get("capstone"):
                result_data["capstone"] = self._process_capstone_data(result_data["capstone"])

            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone created and linked to existing team successfully"),
                "data": result_data,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def _process_capstone_data(self, capstone_data: Dict[Any, Any]) -> Dict[Any, Any]:
        """Process capstone data with metadata"""
        processed = dict(capstone_data)
        processed["department_ids"] = []
        processed["departments"] = []
        capstone_id = processed.get("capstone_id")
        if capstone_id is not None:
            try:
                rows = (
                    supabase.table("capstone_departments")
                    .select("department_fk, departments(department_id,name,active)")
                    .eq("capstone_fk", capstone_id)
                    .execute()
                    .data
                    or []
                )
                departments = [
                    row.get("departments")
                    for row in rows
                    if row.get("departments") is not None
                ]
                processed["departments"] = sorted(
                    departments,
                    key=lambda department: str(department.get("name") or "").lower(),
                )
                processed["department_ids"] = [
                    department.get("department_id")
                    for department in processed["departments"]
                    if department.get("department_id") is not None
                ]
            except Exception:
                processed["department_ids"] = []
                processed["departments"] = []
        course_ids = {
            course_id
            for course_id in (
                processed.get("course_fk"),
                processed.get("requested_course_fk"),
            )
            if course_id is not None
        }
        if course_ids:
            try:
                course_rows = (
                    supabase.table("courses")
                    .select("course_id,code,name,active,active_terms,activation_mode,department_fk,ecosystem_fk,routing_kind,requires_project_support")
                    .in_("course_id", sorted(course_ids))
                    .execute()
                    .data
                    or []
                )
                ecosystem_ids = sorted({
                    row.get("ecosystem_fk")
                    for row in course_rows
                    if row.get("ecosystem_fk") is not None
                })
                ecosystems_by_id: Dict[int, Dict[str, Any]] = {}
                if ecosystem_ids:
                    ecosystem_rows = (
                        supabase.table("project_ecosystems")
                        .select("ecosystem_id,name,description,active")
                        .in_("ecosystem_id", ecosystem_ids)
                        .execute()
                        .data
                        or []
                    )
                    ecosystems_by_id = {
                        int(row["ecosystem_id"]): row
                        for row in ecosystem_rows
                        if row.get("ecosystem_id") is not None
                    }
                for row in course_rows:
                    ecosystem_fk = row.get("ecosystem_fk")
                    row["ecosystem_id"] = ecosystem_fk
                    row["ecosystem"] = (
                        ecosystems_by_id.get(int(ecosystem_fk))
                        if ecosystem_fk is not None
                        else None
                    )
                courses_by_id = {
                    row.get("course_id"): row
                    for row in course_rows
                    if row.get("course_id") is not None
                }
                processed["course"] = courses_by_id.get(processed.get("course_fk"))
                processed["requested_course"] = courses_by_id.get(
                    processed.get("requested_course_fk")
                )
            except Exception:
                processed["course"] = None
                processed["requested_course"] = None
        processed["ecosystem"] = None
        if processed.get("ecosystem_fk") is not None:
            try:
                ecosystem_rows = (
                    supabase.table("project_ecosystems")
                    .select("ecosystem_id,name,description,active")
                    .eq("ecosystem_id", processed.get("ecosystem_fk"))
                    .limit(1)
                    .execute()
                    .data
                    or []
                )
                processed["ecosystem"] = ecosystem_rows[0] if ecosystem_rows else None
            except Exception:
                processed["ecosystem"] = None
        processed['source'] = 'watmatch-server'
        return processed

    def _get_team_for_capstone(self, capstone: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        team_fk = capstone.get("team_fk")
        if team_fk is None:
            return None
        team_res = (
            supabase.table("teams")
            .select("*")
            .eq("team_id", team_fk)
            .limit(1)
            .execute()
        )
        return (team_res.data or [None])[0]

    def _is_student_current_leader_for_capstone(self, capstone: Dict[str, Any], student_id: int) -> bool:
        team = self._get_team_for_capstone(capstone)
        if team:
            return int(team.get("leader_fk") or 0) == int(student_id)
        return int(capstone.get("user_fk") or 0) == int(student_id)

    def _get_capstone_member_ids(self, capstone: Dict[str, Any]) -> list[int]:
        team_fk = capstone.get("team_fk")
        member_ids: list[int] = []
        if team_fk is not None:
            try:
                team_row = self._get_team_for_capstone(capstone)
                if team_row:
                    member_ids = get_team_member_ids(int(team_fk), fallback_team=team_row)
            except Exception as exc:
                logger.warning(
                    "Failed reading members for capstone %s: %s",
                    capstone.get("capstone_id"),
                    exc,
                )
        if not member_ids and capstone.get("user_fk") is not None:
            member_ids = [int(capstone["user_fk"])]
        return sorted({int(member_id) for member_id in member_ids if member_id is not None})

    def _send_decision_email_to_team(self, capstone: Dict[str, Any], decision: str, comments: Optional[str] = None) -> None:
        senders = {
            "approved": send_capstone_approval_email,
            "rejected": send_capstone_rejection_email,
            "changes_requested": send_capstone_changes_email,
        }
        sender = senders.get(decision)
        if sender is None:
            return

        emailed: set[str] = set()
        for member_id in self._get_capstone_member_ids(capstone):
            user_email = self._get_user_email(member_id)
            if not user_email or user_email in emailed:
                continue
            try:
                if decision == "changes_requested":
                    sender(
                        to_email=user_email,
                        project_title=capstone.get("title", "Your project"),
                        comments=comments or "Please review and update your proposal.",
                    )
                else:
                    sender(
                        to_email=user_email,
                        project_title=capstone.get("title", "Your project"),
                    )
                emailed.add(user_email)
            except Exception as exc:
                logger.warning(
                    "Failed sending %s email to user %s: %s",
                    decision,
                    member_id,
                    exc,
                )

    def get_public_recruiting_capstones(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get public discover capstones with DB-level status/filter/pagination."""
        try:
            result = self.capstones_data.get_recruiting_capstones(
                page=page,
                page_size=page_size,
                search=search,
                department=department,
                year=year,
            )
            processed_capstones = [
                self._process_capstone_data(capstone)
                for capstone in result["data"]
            ]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_capstones)} recruiting capstone(s)",
                "data": processed_capstones,
            }

            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size
                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages,
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_public_recruiting_metadata(self) -> Dict[str, Any]:
        """Get complete filter metadata for public recruiting capstones."""
        try:
            payload = self.capstones_data.get_recruiting_capstone_metadata()
            data = payload.get("data") if isinstance(payload, dict) else None
            return {
                "success": True,
                "data": data or {"departments": [], "years": []},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def get_public_finalized_capstones(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get live finalized capstones for read-only discovery."""
        try:
            result = self.capstones_data.get_finalized_capstones(
                page=page,
                page_size=page_size,
                search=search,
                department=department,
                year=year,
            )
            processed_capstones = [
                self._process_capstone_data(capstone)
                for capstone in result["data"]
            ]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_capstones)} finalized capstone(s)",
                "data": processed_capstones,
            }

            if page is not None and page_size is not None:
                total = result.get("total")
                total_pages = None
                if isinstance(total, int) and page_size > 0:
                    total_pages = (total + page_size - 1) // page_size
                response.update({
                    "page": page,
                    "page_size": page_size,
                    "total": total,
                    "total_pages": total_pages,
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_public_finalized_metadata(self) -> Dict[str, Any]:
        """Get complete filter metadata for live finalized capstones."""
        try:
            payload = self.capstones_data.get_finalized_capstone_metadata()
            data = payload.get("data") if isinstance(payload, dict) else None
            return {
                "success": True,
                "data": data or {"departments": [], "years": []},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def list_active_mentors(
        self,
        actor_id: int,
        actor_role: str,
        search: Optional[str] = None,
        department_id: Optional[int] = None,
        availability_term: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            payload = self.capstones_data.list_active_mentors_rpc(
                actor_id=actor_id,
                actor_role=actor_role or "",
                search=search,
                department_id=department_id,
                availability_term=availability_term.strip() if availability_term and availability_term.strip() else None,
            )
            return {
                "success": True,
                "data": payload.get("data") or [],
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def upsert_mentor_profile(
        self,
        actor_id: int,
        actor_role: str,
        mentor_id: Optional[int] = None,
        display_name: Optional[str] = None,
        primary_department_id: Optional[int] = None,
        department_ids: Optional[list[int]] = None,
        affiliation: Optional[str] = None,
        bio: Optional[str] = None,
        availability_terms: Optional[list[str]] = None,
        expertise_tags: Optional[list[str]] = None,
        max_active_projects: Optional[int] = None,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.upsert_mentor_profile_rpc(
                actor_id=actor_id,
                actor_role=actor_role or "",
                mentor_id=mentor_id,
                display_name=display_name.strip() if display_name and display_name.strip() else None,
                primary_department_id=primary_department_id,
                department_ids=department_ids or [],
                affiliation=affiliation.strip() if affiliation and affiliation.strip() else None,
                bio=bio.strip() if bio and bio.strip() else None,
                availability_terms=availability_terms or [],
                expertise_tags=expertise_tags or [],
                max_active_projects=max_active_projects,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def create_mentor_request(
        self,
        capstone_id: int,
        mentor_id: int,
        actor_id: int,
        actor_role: str,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.create_mentor_request_rpc(
                capstone_id=capstone_id,
                mentor_id=mentor_id,
                actor_id=actor_id,
                actor_role=actor_role or "",
                message=message.strip() if message and message.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def create_mentor_offer(
        self,
        capstone_id: int,
        actor_id: int,
        message: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.create_mentor_offer_rpc(
                capstone_id=capstone_id,
                actor_id=actor_id,
                message=message.strip() if message and message.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def decide_mentor_request(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        response_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.decide_mentor_request_rpc(
                request_id=request_id,
                actor_id=actor_id,
                actor_role=actor_role or "",
                decision=decision,
                response_note=response_note.strip() if response_note and response_note.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def decide_mentor_offer(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        decision: str,
        response_note: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.decide_mentor_offer_rpc(
                request_id=request_id,
                actor_id=actor_id,
                actor_role=actor_role or "",
                decision=decision,
                response_note=response_note.strip() if response_note and response_note.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def cancel_mentor_request(
        self,
        request_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.cancel_mentor_request_rpc(
                request_id=request_id,
                actor_id=actor_id,
                actor_role=actor_role or "",
                reason=reason.strip() if reason and reason.strip() else None,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def _mentor_dashboard_public_status(
        self,
        capstone: Dict[str, Any],
        request: Dict[str, Any],
    ) -> Optional[str]:
        status = str(capstone.get("status") or "").lower()
        if status == "approved_recruiting":
            return "recruiting"
        if status == "complete":
            return "complete"
        team = request.get("team")
        if isinstance(team, dict) and str(team.get("status") or "").lower() == "finalized":
            return "finalized"
        return capstone.get("public_status") or capstone.get("status")

    def _enrich_mentor_dashboard_capstones(
        self,
        result: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Merge full capstone records into mentor dashboard RPC payloads.

        Older deployed RPC bodies only return capstone_id/title/status. Keep this
        fallback so mentor decisions always have the same detail level as Discover.
        """
        data = result.get("data")
        if not isinstance(data, dict):
            return result

        capstone_cache: Dict[int, Dict[str, Any]] = {}

        def hydrate_request(request: Dict[str, Any]) -> None:
            if not isinstance(request, dict):
                return

            current = request.get("capstone")
            current_capstone = current if isinstance(current, dict) else {}
            capstone_id = current_capstone.get("capstone_id") or request.get("capstone_fk")
            try:
                normalized_id = int(capstone_id)
            except (TypeError, ValueError):
                return

            if normalized_id not in capstone_cache:
                raw_capstone = self.capstones_data.get_capstone_by_id(normalized_id)
                capstone_cache[normalized_id] = (
                    self._process_capstone_data(raw_capstone)
                    if raw_capstone
                    else {}
                )

            if not capstone_cache[normalized_id]:
                return

            enriched = dict(capstone_cache[normalized_id])
            for key, value in current_capstone.items():
                if value is not None:
                    enriched[key] = value

            departments = enriched.get("departments")
            if not enriched.get("department") and isinstance(departments, list):
                department_names = [
                    department.get("name")
                    for department in departments
                    if isinstance(department, dict) and department.get("name")
                ]
                if department_names:
                    enriched["department"] = ", ".join(department_names)

            if not enriched.get("public_status"):
                enriched["public_status"] = self._mentor_dashboard_public_status(
                    enriched,
                    request,
                )

            request["capstone"] = enriched

        for key in ("pending_requests", "accepted_projects", "offers"):
            rows = data.get(key)
            if isinstance(rows, list):
                for request in rows:
                    hydrate_request(request)

        return result

    def get_mentor_dashboard(
        self,
        actor_id: int,
        actor_role: str,
    ) -> Dict[str, Any]:
        try:
            result = self.capstones_data.get_mentor_dashboard_rpc(
                actor_id=actor_id,
                actor_role=actor_role or "",
            )
            return self._enrich_mentor_dashboard_capstones(result)
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def get_capstone_mentor_requests(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
    ) -> Dict[str, Any]:
        try:
            return self.capstones_data.get_capstone_mentor_requests_rpc(
                capstone_id=capstone_id,
                actor_id=actor_id,
                actor_role=actor_role or "",
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def get_past_capstones(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
        student_id: Optional[int] = None,
        saved_only: bool = False,
    ) -> Dict[str, Any]:
        """Get past capstones with DB-level filtering and pagination."""
        try:
            result = self.capstones_data.get_past_capstones(
                page=page,
                page_size=page_size,
                search=search,
                department=department,
                year=year,
                student_id=student_id,
                saved_only=saved_only,
            )
            data = [self._process_past_capstone_data(row) for row in result.get("data") or []]
            return {
                "success": True,
                "page": result.get("page", page),
                "page_size": result.get("page_size", page_size),
                "total": result.get("total", len(data)),
                "total_pages": result.get("total_pages", 1),
                "data": data,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def _process_past_capstone_data(self, capstone_data: Dict[Any, Any]) -> Dict[Any, Any]:
        processed = dict(capstone_data)
        students = processed.get("students")
        if isinstance(students, list):
            processed["students"] = [
                student.replace("Team Members: ", "").strip()
                if isinstance(student, str)
                else student
                for student in students
            ]
        return processed

    def _normalize_past_shortlist_source(self, source_type: str) -> Optional[str]:
        normalized = (source_type or "").strip().lower()
        if normalized in {"scraped", "historical", "imported", "past"}:
            return "historical"
        if normalized in {"watmatch", "completed", "watmatch_completed"}:
            return "watmatch"
        return None

    def get_past_capstone_metadata(self) -> Dict[str, Any]:
        """Get complete past-capstone filter metadata."""
        try:
            payload = self.capstones_data.get_past_capstone_metadata()
            data = payload.get("data") if isinstance(payload, dict) else None
            return {
                "success": True,
                "data": data or {"departments": [], "years": [], "courses": []},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def get_past_watmatch_capstones(
        self,
        page: int = 1,
        page_size: int = 20,
        search: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
        student_id: Optional[int] = None,
        saved_only: bool = False,
    ) -> Dict[str, Any]:
        """Get completed WatMatch-native capstones with DB-level filtering and pagination."""
        try:
            result = self.capstones_data.get_past_watmatch_capstones(
                page=page,
                page_size=page_size,
                search=search,
                department=department,
                year=year,
                student_id=student_id,
                saved_only=saved_only,
            )
            data = [self._process_past_capstone_data(row) for row in result.get("data") or []]
            return {
                "success": True,
                "page": result.get("page", page),
                "page_size": result.get("page_size", page_size),
                "total": result.get("total", len(data)),
                "total_pages": result.get("total_pages", 1),
                "data": data,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def get_past_watmatch_capstone_metadata(self) -> Dict[str, Any]:
        """Get completed WatMatch-native capstone filter metadata."""
        try:
            payload = self.capstones_data.get_past_watmatch_capstone_metadata()
            data = payload.get("data") if isinstance(payload, dict) else None
            return {
                "success": True,
                "data": data or {"departments": [], "years": [], "courses": []},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def save_past_capstone_shortlist(
        self,
        student_id: int,
        source_type: str,
        source_id: int,
    ) -> Dict[str, Any]:
        if not isinstance(student_id, int) or student_id <= 0:
            return {"success": False, "message": "Invalid student identity.", "data": None}
        if not isinstance(source_id, int) or source_id <= 0:
            return {"success": False, "message": "Invalid past capstone ID.", "data": None}
        normalized_source = self._normalize_past_shortlist_source(source_type)
        if not normalized_source:
            return {"success": False, "message": "Unsupported past capstone source.", "data": None}

        try:
            return self.capstones_data.upsert_past_capstone_shortlist_rpc(
                student_id=student_id,
                source_type=normalized_source,
                source_id=source_id,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def delete_past_capstone_shortlist(
        self,
        student_id: int,
        source_type: str,
        source_id: int,
    ) -> Dict[str, Any]:
        if not isinstance(student_id, int) or student_id <= 0:
            return {"success": False, "message": "Invalid student identity.", "data": None}
        if not isinstance(source_id, int) or source_id <= 0:
            return {"success": False, "message": "Invalid past capstone ID.", "data": None}
        normalized_source = self._normalize_past_shortlist_source(source_type)
        if not normalized_source:
            return {"success": False, "message": "Unsupported past capstone source.", "data": None}

        try:
            return self.capstones_data.delete_past_capstone_shortlist_rpc(
                student_id=student_id,
                source_type=normalized_source,
                source_id=source_id,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def list_student_past_capstone_shortlists(
        self,
        student_id: int,
        limit: int = 6,
    ) -> Dict[str, Any]:
        if not isinstance(student_id, int) or student_id <= 0:
            return {"success": False, "message": "Invalid student identity.", "data": None}
        if not isinstance(limit, int) or limit <= 0:
            return {"success": False, "message": "Invalid saved-capstone limit.", "data": None}

        try:
            payload = self.capstones_data.list_student_past_capstone_shortlists_rpc(
                student_id=student_id,
                limit=limit,
            )
            data = [self._process_past_capstone_data(row) for row in payload.get("data") or []]
            return {
                "success": payload.get("success", True),
                "message": payload.get("message", "Saved past capstones retrieved."),
                "data": data,
            }
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def upsert_past_capstone(
        self,
        actor_id: int,
        past_capstone_id: Optional[int] = None,
        title: Optional[str] = None,
        description: Optional[str] = None,
        department: Optional[str] = None,
        year: Optional[str] = None,
        students: Optional[list[str]] = None,
        source_course_id: Optional[int] = None,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        if past_capstone_id is not None and past_capstone_id <= 0:
            return {"success": False, "message": "Invalid past capstone ID.", "data": None}
        if not title or not title.strip():
            return {"success": False, "message": "Past capstone title is required.", "data": None}
        if not department or not department.strip():
            return {"success": False, "message": "Past capstone department is required.", "data": None}
        if not year or not str(year).strip():
            return {"success": False, "message": "Past capstone year is required.", "data": None}
        trimmed_reason = reason.strip() if reason and reason.strip() else None
        if not trimmed_reason:
            return {
                "success": False,
                "message": "An audit reason is required for manual past capstone changes.",
                "data": None,
            }

        try:
            return self.capstones_data.upsert_past_capstone_rpc(
                past_capstone_id=past_capstone_id,
                title=title.strip(),
                description=description.strip() if description and description.strip() else None,
                department=department.strip(),
                year=str(year).strip(),
                students=self._normalize_past_capstone_students(students),
                source_course_id=source_course_id,
                actor_id=actor_id,
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def delete_past_capstone(
        self,
        past_capstone_id: int,
        actor_id: int,
        reason: Optional[str] = None,
    ) -> Dict[str, Any]:
        if not isinstance(past_capstone_id, int) or past_capstone_id <= 0:
            return {"success": False, "message": "Invalid past capstone ID.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}
        trimmed_reason = reason.strip() if reason and reason.strip() else None
        if not trimmed_reason:
            return {
                "success": False,
                "message": "An audit reason is required when deleting a past capstone.",
                "data": None,
            }

        try:
            return self.capstones_data.delete_past_capstone_rpc(
                past_capstone_id=past_capstone_id,
                actor_id=actor_id,
                reason=trimmed_reason,
            )
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def import_past_capstones_csv(self, csv_text: str, actor_id: int) -> Dict[str, Any]:
        if not csv_text or not csv_text.strip():
            return {"success": False, "message": "CSV content is required.", "data": None}
        if not actor_id:
            return {"success": False, "message": "Invalid actor identity.", "data": None}

        try:
            reader = csv.DictReader(io.StringIO(csv_text.strip()))
            headers = {
                header.strip().lstrip("\ufeff").lower()
                for header in (reader.fieldnames or [])
                if header
            }
            required_headers = {"title", "department", "year"}
            missing = sorted(required_headers - headers)
            if missing:
                return {
                    "success": False,
                    "message": f"CSV is missing required header(s): {', '.join(missing)}.",
                    "data": None,
                }

            courses = (
                supabase.table("courses")
                .select("course_id,code")
                .execute()
                .data
                or []
            )
            courses_by_code: Dict[str, Dict[int, Dict[str, Any]]] = {}
            for course in courses:
                raw_code = str(course.get("code") or "").strip().upper()
                course_id = course.get("course_id")
                if raw_code and course_id is not None:
                    for alias in {raw_code, raw_code.replace(" ", "")}:
                        courses_by_code.setdefault(alias, {})[int(course_id)] = course

            summary: Dict[str, Any] = {"created": 0, "updated": 0, "errors": []}
            for row_number, row in enumerate(reader, start=2):
                normalized_row = {
                    (key or "").strip().lstrip("\ufeff").lower(): (value or "").strip()
                    for key, value in row.items()
                }
                source_course_id: Optional[int] = None
                source_code = (normalized_row.get("source_course_code") or "").upper()
                if source_code:
                    matches = list(
                        (
                            courses_by_code.get(source_code)
                            or courses_by_code.get(source_code.replace(" ", ""))
                            or {}
                        ).values()
                    )
                    if not matches:
                        summary["errors"].append({
                            "row": row_number,
                            "title": normalized_row.get("title"),
                            "error": f"Source course {source_code} was not found.",
                        })
                        continue
                    source_course_id = int(matches[0]["course_id"])

                past_id_text = normalized_row.get("past_capstone_id") or normalized_row.get("id")
                past_capstone_id: Optional[int] = None
                if past_id_text:
                    try:
                        past_capstone_id = int(past_id_text)
                    except ValueError:
                        summary["errors"].append({
                            "row": row_number,
                            "title": normalized_row.get("title"),
                            "error": "Invalid past_capstone_id.",
                        })
                        continue

                result = self.upsert_past_capstone(
                    actor_id=actor_id,
                    past_capstone_id=past_capstone_id,
                    title=normalized_row.get("title"),
                    description=normalized_row.get("description"),
                    department=normalized_row.get("department"),
                    year=normalized_row.get("year"),
                    students=self._split_past_capstone_students(normalized_row.get("students")),
                    source_course_id=source_course_id,
                    reason="csv_import",
                )
                if not result.get("success"):
                    summary["errors"].append({
                        "row": row_number,
                        "title": normalized_row.get("title"),
                        "error": result.get("message", "Import failed."),
                    })
                    continue

                if past_capstone_id:
                    summary["updated"] += 1
                else:
                    summary["created"] += 1

            return {
                "success": True,
                "message": "Past capstone import processed.",
                "data": summary,
            }
        except csv.Error as e:
            return {"success": False, "message": f"CSV parse error: {str(e)}", "data": None}
        except Exception as e:
            return {"success": False, "message": f"Business logic error: {str(e)}", "data": None}

    def _split_past_capstone_students(self, raw_students: Optional[str]) -> list[str]:
        if not raw_students:
            return []
        separator = "|" if "|" in raw_students else ";"
        return [student.strip() for student in raw_students.split(separator) if student.strip()]

    def _normalize_past_capstone_students(self, students: Optional[list[str]]) -> list[str]:
        if not students:
            return []
        seen: set[str] = set()
        normalized: list[str] = []
        for student in students:
            if not isinstance(student, str):
                continue
            value = student.strip()
            if not value or value.lower() in seen:
                continue
            seen.add(value.lower())
            normalized.append(value)
        return normalized

    def get_capstones_pending_review(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        actor_role: Optional[str] = None,
        actor_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get unapproved capstones (new + resubmitted)."""
        try:
            result = self.capstones_data.get_review_capstones(
                actor_id=actor_id,
                actor_role=actor_role or "",
                page=page,
                page_size=page_size,
            )
            paginated_capstones = result["data"]
            total = result.get("total", len(paginated_capstones))

            processed_capstones = [
                self._process_capstone_data(capstone)
                for capstone in paginated_capstones
            ]

            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(processed_capstones)} capstone(s) requiring review",
                "data": processed_capstones
            }

            if page is not None and page_size is not None and page_size > 0:
                total_pages = (total + page_size - 1) // page_size
                response.update({
                    "page": result.get("page", page),
                    "page_size": result.get("page_size", page_size),
                    "total": total,
                    "total_pages": total_pages
                })

            return response

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_capstones_pending_course_routing(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        actor_role: Optional[str] = None,
        actor_id: Optional[int] = None,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get capstones waiting for course-routing decisions."""
        try:
            result = self.capstones_data.get_course_routing_capstones(
                actor_id=actor_id,
                actor_role=actor_role or "",
                page=page,
                page_size=page_size,
                search=search.strip() if search and search.strip() else None,
                course_id=course_id,
                department_id=department_id,
            )
            items = result["data"]
            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(items)} capstone(s) awaiting course routing",
                "data": items,
            }
            if page is not None and page_size is not None and page_size > 0:
                total = result.get("total", len(items))
                response.update({
                    "page": result.get("page", page),
                    "page_size": result.get("page_size", page_size),
                    "total": total,
                    "total_pages": (total + page_size - 1) // page_size,
                })
            return response
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def route_capstone_course(
        self,
        capstone_id: int,
        target_course_id: int,
        actor_id: int,
        actor_role: str,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Admin routes a capstone to its target course for instructor review."""
        try:
            rpc_result = self.capstones_data.route_capstone_course_rpc(
                capstone_id=capstone_id,
                actor_id=actor_id,
                actor_role=actor_role,
                target_course_id=target_course_id,
                comments=comments.strip() if comments and comments.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Course routing failed."), "data": None}
            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone routed for instructor review."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def create_project_submission_enrollment_request(
        self,
        student_id: int,
        target_course_id: int,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Student requests course enrollment before submitting a capstone proposal."""
        try:
            if student_id <= 0 or target_course_id <= 0:
                return {"success": False, "message": "Invalid submission enrollment request.", "data": None}
            rpc_result = self.capstones_data.create_project_submission_enrollment_request_rpc(
                student_id=student_id,
                target_course_id=target_course_id,
                comments=comments.strip() if comments and comments.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Enrollment request failed."), "data": None}
            return {
                "success": True,
                "message": rpc_result.get("message", "Course enrollment request submitted."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def get_project_submission_enrollment_requests(
        self,
        page: Optional[int] = None,
        page_size: Optional[int] = None,
        actor_role: Optional[str] = None,
        actor_id: Optional[int] = None,
        search: Optional[str] = None,
        course_id: Optional[int] = None,
        department_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """Get capstone submission enrollment requests for staff."""
        try:
            result = self.capstones_data.get_project_submission_enrollment_requests(
                actor_id=actor_id,
                actor_role=actor_role or "",
                page=page,
                page_size=page_size,
                search=search.strip() if search and search.strip() else None,
                course_id=course_id,
                department_id=department_id,
            )
            items = result["data"]
            response: Dict[str, Any] = {
                "success": True,
                "message": f"Retrieved {len(items)} project submission enrollment request(s)",
                "data": items,
            }
            if page is not None and page_size is not None and page_size > 0:
                total = result.get("total", len(items))
                response.update({
                    "page": result.get("page", page),
                    "page_size": result.get("page_size", page_size),
                    "total": total,
                    "total_pages": result.get("total_pages") or (total + page_size - 1) // page_size,
                })
            return response
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def decide_project_submission_enrollment_request(
        self,
        request_id: int,
        decision: str,
        actor_id: int,
        actor_role: str,
        target_course_id: Optional[int] = None,
        comments: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Staff approves or rejects a no-course student's course request for proposal submission."""
        try:
            normalized_decision = (decision or "").strip().lower()
            if normalized_decision not in {"approve", "reject", "cancel"}:
                return {"success": False, "message": "Decision must be approve, reject, or cancel.", "data": None}
            if normalized_decision == "approve" and target_course_id is None:
                return {"success": False, "message": "Target course is required to approve enrollment.", "data": None}
            rpc_result = self.capstones_data.decide_project_submission_enrollment_request_rpc(
                request_id=request_id,
                actor_id=actor_id,
                actor_role=actor_role,
                decision=normalized_decision,
                target_course_id=target_course_id,
                comments=comments.strip() if comments and comments.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Submission enrollment decision failed."), "data": None}
            return {
                "success": True,
                "message": rpc_result.get("message", "Submission enrollment decision saved."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def approve_capstone(
        self,
        capstone_id: int,
        instructor_id: Optional[int] = None,
        actor_role: Optional[str] = None,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        """Record a transactional per-course instructor approval via Supabase RPC."""
        try:
            rpc_result = self.capstones_data.review_capstone_rpc(
                capstone_id=capstone_id,
                actor_id=instructor_id,
                actor_role=actor_role,
                decision="approve",
                comments=comments.strip() if comments and comments.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Approval failed."), "data": None}

            capstone = rpc_result.get("capstone") or self.capstones_data.get_capstone_by_id(capstone_id)
            if rpc_result.get("email_decision") == "approved" and capstone:
                self._send_decision_email_to_team(capstone, "approved")

            message = (
                "Capstone approved and opened for student interest."
                if rpc_result.get("email_decision") == "approved"
                else "Approval recorded. This project is still under review."
            )

            return {
                "success": True,
                "message": message,
                "data": self._process_capstone_data(capstone) if capstone else None,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def get_capstone_by_id(self, capstone_id: int) -> Dict[str, Any]:
        """Retrieve a single capstone by its identifier."""
        try:
            if not isinstance(capstone_id, int) or capstone_id <= 0:
                return {
                    "success": False,
                    "message": "Invalid capstone ID. Must be a positive integer.",
                    "data": None
                }

            capstone = self.capstones_data.get_capstone_by_id(capstone_id)

            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None
                }

            return {
                "success": True,
                "message": "Capstone retrieved successfully",
                "data": self._process_capstone_data(capstone)
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def reject_capstone(
        self,
        capstone_id: int,
        instructor_id: Optional[int] = None,
        actor_role: Optional[str] = None,
        comments: Optional[str] = None
    ) -> Dict[str, Any]:
        """Reject a capstone via transactional Supabase RPC."""
        try:
            rpc_result = self.capstones_data.review_capstone_rpc(
                capstone_id=capstone_id,
                actor_id=instructor_id,
                actor_role=actor_role,
                decision="reject",
                comments=comments.strip() if comments and comments.strip() else None,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Rejection failed."), "data": None}

            capstone = rpc_result.get("capstone") or self.capstones_data.get_capstone_by_id(capstone_id)
            if rpc_result.get("email_decision") == "rejected" and capstone:
                self._send_decision_email_to_team(capstone, "rejected")

            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone rejected successfully."),
                "data": self._process_capstone_data(capstone) if capstone else None,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def request_changes(
        self,
        capstone_id: int,
        comments: str,
        instructor_id: Optional[int] = None,
        actor_role: Optional[str] = None
    ) -> Dict[str, Any]:
        """Request capstone changes via transactional Supabase RPC."""
        try:
            rpc_result = self.capstones_data.review_capstone_rpc(
                capstone_id=capstone_id,
                actor_id=instructor_id,
                actor_role=actor_role,
                decision="request_changes",
                comments=comments.strip(),
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Request changes failed."), "data": None}

            capstone = rpc_result.get("capstone") or self.capstones_data.get_capstone_by_id(capstone_id)
            if rpc_result.get("email_decision") == "changes_requested" and capstone:
                self._send_decision_email_to_team(capstone, "changes_requested", comments=comments)

            return {
                "success": True,
                "message": rpc_result.get("message", "Changes requested successfully."),
                "data": self._process_capstone_data(capstone) if capstone else None,
            }

        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def resubmit_capstone(
        self,
        capstone_id: int,
        student_id: int,
        update_data: Dict[str, Any],
        change_summary: str
    ) -> Dict[str, Any]:
        """Student updates a capstone after change request and sends it back for review."""
        try:
            capstone = self.capstones_data.get_capstone_by_id(capstone_id)
            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None
                }

            if not self._is_student_current_leader_for_capstone(capstone, student_id):
                return {
                    "success": False,
                    "message": "Only the current team leader can resubmit this project",
                    "data": None
                }

            current_status = (capstone.get("status") or "").lower()
            if capstone.get("archived") is True or current_status in {"approved", "complete", "archived"}:
                return {
                    "success": False,
                    "message": "This capstone cannot be resubmitted in its current state.",
                    "data": None,
                }
            if current_status not in {"draft", "rejected", "changes_requested"}:
                return {
                    "success": False,
                    "message": "Only draft, rejected, or change-requested capstones can be resubmitted.",
                    "data": None,
                }

            payload = {
                "title": update_data.get("title"),
                "description": update_data.get("description"),
                "project_start_date": update_data.get("project_start_date"),
                "disciplines": update_data.get("disciplines"),
                "department_ids": update_data.get("department_ids"),
                "skills": update_data.get("skills"),
                "problem_area": update_data.get("problem_area"),
                "main_objectives": update_data.get("main_objectives"),
                "scope_of_work": update_data.get("scope_of_work"),
                "deliverables": update_data.get("deliverables"),
                "meeting_frequency": update_data.get("meeting_frequency"),
                "uw_resources": update_data.get("uw_resources"),
                "org_resources": update_data.get("org_resources"),
                "other_resources": update_data.get("other_resources"),
                "how_heard_about_capstone": update_data.get("how_heard_about_capstone"),
                "deliverable_types": update_data.get("deliverable_types"),
                "proposed_team_members": update_data.get("proposed_team_members"),
                "success_criteria": update_data.get("success_criteria"),
                "validation_plan": update_data.get("validation_plan"),
                "stakeholders": update_data.get("stakeholders"),
                "risks_constraints": update_data.get("risks_constraints"),
                "public_evaluation_acknowledged": update_data.get("public_evaluation_acknowledged", False),
                "ip_acknowledged": update_data.get("ip_acknowledged", False),
                "confidentiality_acknowledged": update_data.get("confidentiality_acknowledged", False),
                "ecosystem_id": update_data.get("ecosystem_id"),
                "organization_name": update_data.get("organization_name"),
                "primary_contact": update_data.get("primary_contact"),
                "email": update_data.get("email"),
                "phone": update_data.get("phone"),
                "website": update_data.get("website"),
                "organization_description": update_data.get("organization_description"),
                "organization_size": update_data.get("organization_size"),
                "sector": update_data.get("sector"),
                "partner_opportunity_id": update_data.get("partner_opportunity_id"),
                "external_partner_name": update_data.get("external_partner_name"),
                "external_partner_organization": update_data.get("external_partner_organization"),
                "external_partner_email": update_data.get("external_partner_email"),
                "external_partner_website": update_data.get("external_partner_website"),
                "external_partner_notes": update_data.get("external_partner_notes"),
                "external_partner_confirmed": update_data.get("external_partner_confirmed", False),
            }

            rpc_result = self.capstones_data.resubmit_capstone_rpc(
                capstone_id=capstone_id,
                student_id=student_id,
                payload=payload,
                change_summary=change_summary,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Resubmission failed."), "data": None}

            updated_capstone = rpc_result.get("data")

            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone resubmitted for instructor review"),
                "data": self._process_capstone_data(updated_capstone) if updated_capstone else None
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def withdraw_capstone_review(self, capstone_id: int, student_id: int) -> Dict[str, Any]:
        """Team leader reopens a review/recruiting capstone for edits."""
        try:
            capstone = self.capstones_data.get_capstone_by_id(capstone_id)
            if not capstone:
                return {
                    "success": False,
                    "message": f"Capstone with ID {capstone_id} not found",
                    "data": None,
                }

            if not self._is_student_current_leader_for_capstone(capstone, student_id):
                return {
                    "success": False,
                    "message": "Only the current team leader can reopen this project for edits.",
                    "data": None,
                }

            current_status = (capstone.get("status") or "").lower()
            if capstone.get("archived") is True or current_status in {"approved", "complete", "archived"}:
                return {
                    "success": False,
                    "message": "This capstone cannot be reopened for edits in its current state.",
                    "data": None,
                }
            if current_status not in {"draft", "approved_recruiting", "pending_review", "pending_admin_course_routing"}:
                return {
                    "success": False,
                    "message": "Only capstones in review or accepting-interest states can be reopened for edits.",
                    "data": None,
                }

            rpc_result = self.capstones_data.withdraw_capstone_review_rpc(
                capstone_id=capstone_id,
                student_id=student_id,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Withdrawal failed."), "data": None}

            updated_capstone = rpc_result.get("data")
            return {
                "success": True,
                "message": "Capstone reopened for edits.",
                "data": self._process_capstone_data(updated_capstone) if updated_capstone else None,
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def delete_capstone_as_privileged(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Archive a capstone through the transactional Supabase RPC."""
        try:
            trimmed_reason = reason.strip() if reason and reason.strip() else None
            if not trimmed_reason:
                return {
                    "success": False,
                    "message": "An audit reason is required when archiving a capstone.",
                    "data": None,
                }
            rpc_result = self.capstones_data.archive_capstone_rpc(
                capstone_id=capstone_id,
                actor_id=actor_id,
                actor_role=actor_role,
                reason=trimmed_reason,
            )
            if not rpc_result.get("success"):
                return {"success": False, "message": rpc_result.get("message", "Archive workflow failed."), "data": None}
            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone archived successfully."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None
            }

    def complete_capstone(
        self,
        capstone_id: int,
        actor_id: int,
        actor_role: str,
        notes: Optional[str] = None,
        completed_term: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Mark a finalized capstone as academically complete."""
        try:
            trimmed_notes = notes.strip() if notes and notes.strip() else None
            if not trimmed_notes:
                return {
                    "success": False,
                    "message": "Completion notes are required when marking a capstone complete.",
                    "data": None,
                }
            rpc_result = self.capstones_data.complete_capstone_rpc(
                capstone_id=capstone_id,
                actor_id=actor_id,
                actor_role=actor_role,
                notes=trimmed_notes,
                completed_term=completed_term.strip() if completed_term and completed_term.strip() else None,
            )
            if not rpc_result.get("success"):
                return {
                    "success": False,
                    "message": rpc_result.get("message", "Completion workflow failed."),
                    "data": None,
                }
            return {
                "success": True,
                "message": rpc_result.get("message", "Capstone marked complete."),
                "data": rpc_result.get("data"),
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Business logic error: {str(e)}",
                "data": None,
            }

    def _get_user_email(self, user_id: int) -> Optional[str]:
        """Fetch a user's email from the users table."""
        try:
            response = supabase.table("users").select(
                "email").eq("user_id", user_id).execute()
            if not response.data:
                return None
            return response.data[0].get("email")
        except Exception as e:
            logger.warning("Failed to fetch user email: %s", e)
            return None
