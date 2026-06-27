"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { userContext } from "@/contexts/UserContext";
import { Menu } from "lucide-react";
import {
    deleteTeam,
    fetchTeamInvites,
    fetchTeams,
    finalizeTeam,
    reassignLeader,
    revokeInvite,
    type TeamPendingInvite,
} from "@/services/teams.service";
import { fetchUserById } from "@/services/users.service";
import { fetchCourses, type Course } from "@/services/courses.service";
import {
    cancelMentorRequest,
    completeCapstone,
    decideMentorOffer,
    fetchActiveMentors,
    fetchCapstoneMentorRequests,
    requestMentor,
    type CapstoneSupportSummary,
    type MentorRequest,
    type MentorUserSummary,
} from "@/services/capstones.service";

interface MemberRecord {
    user_id?: string | number;
    id?: string | number;
    name?: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    full_name?: string;
    fullName?: string;
    username?: string;
    email?: string;
    course_fk?: number | string | null;
    course?: Course | null;
    enrollment_course_fk?: number | string | null;
    enrollment_course?: Course | null;
    enrollment_notes?: string | null;
    home_department?:
        | string
        | {
              department_id?: number;
              name?: string;
              active?: boolean;
          }
        | null;
    home_department_id?: number | null;
}

type UserRecord = MemberRecord;

function mentorDirectoryLabel(mentor: MentorUserSummary): string {
    const profile = mentor.profile;
    const name = profile?.display_name || mentor.email;
    const affiliation =
        profile?.primary_department?.name ||
        profile?.departments?.[0]?.name ||
        profile?.affiliation;
    const expertise = (profile?.expertise_tags || []).slice(0, 2).join(", ");
    return [name, affiliation, expertise].filter(Boolean).join(" - ");
}

interface CapstoneRecord {
    capstone_id?: string | number;
    id?: string | number;
    title?: string;
    name?: string;
    project_title?: string;
    projectTitle?: string;
    status?: string;
    disciplines?: string[];
    completed_at?: string | null;
    completed_term?: string | null;
    completion_notes?: string | null;
}

interface TeamRecord {
    team_id?: string | number;
    id?: string | number;
    capstone_fk?: string | number;
    capstone?: CapstoneRecord | null;
    capstone_title?: string;
    project_title?: string;
    status?: string;
    leader_fk?: string | number;
    course_fk?: string | number;
    members?: Array<string | number | MemberRecord | UserRecord>;
    member_details?: MemberRecord[];
    pending_commitment_request_count?: number;
    mutually_confirmed_exploration_count?: number;
}

interface TeamsApiResponse {
    success?: boolean;
    data?: TeamRecord[];
    teams?: TeamRecord[];
}

const NO_MENTOR = "none";

type ReadinessItem = {
    label: string;
    ready: boolean;
    detail: string;
};

function FinalizationReadinessChecklist({ items }: { items: ReadinessItem[] }) {
    const readyCount = items.filter((item) => item.ready).length;
    return (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Finalization Readiness
                </p>
                <span className="text-xs text-slate-500">
                    {readyCount}/{items.length} ready
                </span>
            </div>
            <ul className="mt-3 space-y-2">
                {items.map((item) => (
                    <li key={item.label} className="flex gap-2 text-sm">
                        <span
                            className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                                item.ready ? "bg-emerald-500" : "bg-amber-400"
                            }`}
                            aria-hidden="true"
                        />
                        <div>
                            <p className="font-medium text-slate-800">{item.label}</p>
                            <p className="text-xs text-slate-600">{item.detail}</p>
                        </div>
                    </li>
                ))}
            </ul>
        </div>
    );
}

interface EnrichedTeamRecord extends TeamRecord {
    resolvedMembers?: string[] | null;
    resolvedCapstoneTitle?: string | null;
    resolvedCapstoneStatus?: string | null;
}

const formatStatusLabel = (value?: string) => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (trimmed.toLowerCase() === "pending_admin_course_routing") {
        return "Awaiting Course Routing";
    }
    if (trimmed.toLowerCase() === "pending_review") {
        return "Awaiting Instructor Review";
    }
    if (trimmed.toLowerCase() === "draft") {
        return "Draft";
    }
    if (trimmed.toLowerCase() === "approved_recruiting") {
        return "Approved - Recruiting";
    }
    if (trimmed.toLowerCase() === "complete") {
        return "Complete";
    }

    return trimmed
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const getNumericTeamMemberIds = (team?: TeamRecord | null) => {
    if (!team || !Array.isArray(team.members)) {
        return [];
    }

    const ids = team.members
        .map((member) => {
            if (typeof member === "number" && Number.isInteger(member)) {
                return member;
            }

            if (typeof member === "string" && /^\d+$/.test(member.trim())) {
                return Number(member.trim());
            }

            if (member && typeof member === "object" && !Array.isArray(member)) {
                const rawId = (member as UserRecord).user_id ?? (member as UserRecord).id;
                const parsedId = Number(rawId);
                return Number.isInteger(parsedId) ? parsedId : null;
            }

            return null;
        })
        .filter((memberId): memberId is number => memberId !== null);

    return Array.from(new Set(ids));
};

const getEligibleLeaderIds = (team?: EnrichedTeamRecord | null) => {
    const currentLeaderId = Number(team?.leader_fk);
    return getNumericTeamMemberIds(team).filter(
        (memberId) => !Number.isInteger(currentLeaderId) || memberId !== currentLeaderId
    );
};

const getMemberOptionLabel = (team: EnrichedTeamRecord | null, memberId: number) => {
    const memberIds = getNumericTeamMemberIds(team);
    const memberIndex = memberIds.indexOf(memberId);
    const resolvedName =
        memberIndex >= 0 ? team?.resolvedMembers?.[memberIndex] : null;

    return resolvedName ? `${resolvedName} (#${memberId})` : `User #${memberId}`;
};

const getMemberDepartmentName = (member?: MemberRecord | null) => {
    const department = member?.home_department;
    if (!department) return null;
    if (typeof department === "string") return department.trim() || null;
    return department.name?.trim() || null;
};

const getMemberEnrollmentCourseLabel = (member?: MemberRecord | null) => {
    if (!member) return null;
    if (member.enrollment_course?.code) {
        return member.enrollment_course.code;
    }
    if (member.course?.code) {
        return member.course.code;
    }
    const fallbackId = member.enrollment_course_fk ?? member.course_fk;
    return fallbackId ? `Course #${fallbackId}` : null;
};

const memberHasReadyEnrollmentCourse = (
    member: MemberRecord,
    courseMap: Record<number, Course>
) => {
    const rawCourseId = member.enrollment_course_fk ?? member.course_fk;
    const courseId = Number(rawCourseId);
    if (!Number.isInteger(courseId) || courseId <= 0) {
        return false;
    }
    const course = member.enrollment_course ?? member.course ?? courseMap[courseId];
    return (
        course?.active !== false &&
        (course?.active_instructor_count === undefined ||
            Number(course.active_instructor_count) > 0)
    );
};

const getMemberDisplayName = (member?: MemberRecord | null) => {
    if (!member) return null;
    if (member.email) return member.email;
    const parts = [
        member.first_name ?? member.firstName,
        member.last_name ?? member.lastName,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(" ");
    return member.full_name ?? member.fullName ?? member.name ?? member.username ?? null;
};

const getTeamId = (team: TeamRecord | null | undefined) => {
    const rawId = team?.team_id ?? team?.id;
    const parsed = Number(rawId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getCapstoneId = (team: TeamRecord | null | undefined) => {
    const rawId = team?.capstone?.capstone_id ?? team?.capstone?.id ?? team?.capstone_fk;
    const parsed = Number(rawId);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const canRequestMentorForTeam = (team: EnrichedTeamRecord) => {
    const capstoneStatus = (
        team.resolvedCapstoneStatus ??
        team.capstone?.status ??
        ""
    ).toLowerCase();
    const teamStatus = (team.status || "").toLowerCase();
    return (
        getCapstoneId(team) !== null &&
        teamStatus !== "finalized" &&
        teamStatus !== "archived" &&
        ["draft", "pending_admin_course_routing", "pending_review", "approved_recruiting"].includes(
            capstoneStatus
        )
    );
};

export function CapstoneTeamsSection() {
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const canManageTeams =
        normalizedRole === "instructor" || normalizedRole === "admin";

    const [teams, setTeams] = useState<EnrichedTeamRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 5;
    const [deletingTeamId, setDeletingTeamId] = useState<string | number | null>(
        null
    );
    const [reassigningTeamId, setReassigningTeamId] = useState<
        string | number | null
    >(null);
    const [courseMap, setCourseMap] = useState<Record<number, Course>>({});
    const [teamToDelete, setTeamToDelete] = useState<EnrichedTeamRecord | null>(
        null
    );
    const [deleteReason, setDeleteReason] = useState("");
    const [teamToReassign, setTeamToReassign] =
        useState<EnrichedTeamRecord | null>(null);
    const [teamToComplete, setTeamToComplete] =
        useState<EnrichedTeamRecord | null>(null);
    const [teamToFinalize, setTeamToFinalize] =
        useState<EnrichedTeamRecord | null>(null);
    const [newLeaderId, setNewLeaderId] = useState("");
    const [reassignReason, setReassignReason] = useState("");
    const [completionNotes, setCompletionNotes] = useState("");
    const [finalizationReason, setFinalizationReason] = useState("");
    const [completingCapstoneId, setCompletingCapstoneId] = useState<
        string | number | null
    >(null);
    const [finalizingTeamId, setFinalizingTeamId] = useState<
        string | number | null
    >(null);
    const [teamInvitesById, setTeamInvitesById] = useState<
        Record<number, TeamPendingInvite[]>
    >({});
    const [inviteErrorsByTeamId, setInviteErrorsByTeamId] = useState<
        Record<number, string>
    >({});
    const [loadingInviteTeamIds, setLoadingInviteTeamIds] = useState<Set<number>>(
        () => new Set()
    );
    const [revokingInviteId, setRevokingInviteId] = useState<string | null>(null);
    const [mentorRequestsByCapstoneId, setMentorRequestsByCapstoneId] = useState<
        Record<string, MentorRequest[]>
    >({});
    const [supportByCapstoneId, setSupportByCapstoneId] = useState<
        Record<string, CapstoneSupportSummary>
    >({});
    const [mentorErrorsByCapstoneId, setMentorErrorsByCapstoneId] = useState<
        Record<string, string>
    >({});
    const [loadingMentorCapstoneIds, setLoadingMentorCapstoneIds] = useState<Set<string>>(
        () => new Set()
    );
    const [activeMentors, setActiveMentors] = useState<MentorUserSummary[]>([]);
    const [mentorDraftsByCapstoneId, setMentorDraftsByCapstoneId] = useState<
        Record<string, { mentorId: string; message: string }>
    >({});
    const [mentorActionKey, setMentorActionKey] = useState<string | null>(null);
    const [departmentFilter, setDepartmentFilter] = useState("All");

    const homeDepartmentName = user?.home_department?.name;
    const departmentOptions = useMemo(() => {
        const departments = new Set<string>();
        if (homeDepartmentName) departments.add(homeDepartmentName);
        teams.forEach((team) => {
            (team.capstone?.disciplines || []).forEach((department) => {
                if (department?.trim()) departments.add(department.trim());
            });
        });
        return Array.from(departments).sort((a, b) => a.localeCompare(b));
    }, [homeDepartmentName, teams]);
    const filteredTeams = useMemo(() => {
        if (departmentFilter === "All") return teams;
        return teams.filter((team) =>
            (team.capstone?.disciplines || []).some(
                (department) =>
                    department.trim().toLowerCase() ===
                    departmentFilter.trim().toLowerCase()
            )
        );
    }, [departmentFilter, teams]);
    const totalPages = useMemo(() => {
        const rawTotal = Math.ceil(filteredTeams.length / pageSize);
        return Math.max(1, Number.isNaN(rawTotal) ? 1 : rawTotal);
    }, [filteredTeams.length, pageSize]);

    const paginatedTeams = useMemo(() => {
        const safePage = Math.max(1, page);
        const start = (safePage - 1) * pageSize;
        return filteredTeams.slice(start, start + pageSize);
    }, [filteredTeams, page, pageSize]);

    const paginatedTeamIds = useMemo(
        () =>
            paginatedTeams
                .map(getTeamId)
                .filter((teamId): teamId is number => teamId !== null),
        [paginatedTeams]
    );

    const paginatedTeamIdKey = paginatedTeamIds.join(",");
    const paginatedCapstoneIds = useMemo(
        () =>
            paginatedTeams
                .map(getCapstoneId)
                .filter((capstoneId): capstoneId is number => capstoneId !== null),
        [paginatedTeams]
    );
    const paginatedCapstoneIdKey = paginatedCapstoneIds.join(",");

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        } else if (page < 1) {
            setPage(1);
        }
    }, [page, totalPages]);

    useEffect(() => {
        if (homeDepartmentName && departmentFilter === "All") {
            setDepartmentFilter(homeDepartmentName);
        }
    }, [departmentFilter, homeDepartmentName]);

    useEffect(() => {
        if (!canManageTeams) return;
        async function loadCourses() {
            try {
                const courses = await fetchCourses(false);
                const mapped = (courses || []).reduce<Record<number, Course>>(
                    (acc, course) => {
                        acc[course.course_id] = course;
                        return acc;
                    },
                    {}
                );
                setCourseMap(mapped);
            } catch (err) {
                console.error("Failed to load courses for team cards:", err);
                setCourseMap({});
            }
        }
        loadCourses();
    }, [canManageTeams]);

    useEffect(() => {
        const teamIds = paginatedTeamIdKey
            ? paginatedTeamIdKey
                  .split(",")
                  .map(Number)
                  .filter((teamId) => Number.isInteger(teamId) && teamId > 0)
            : [];

        if (!canManageTeams || teamIds.length === 0) {
            return;
        }

        let isMounted = true;
        setLoadingInviteTeamIds((current) => {
            const next = new Set(current);
            teamIds.forEach((teamId) => next.add(teamId));
            return next;
        });

        async function loadInvitesForPage() {
            const results = await Promise.all(
                teamIds.map(async (teamId) => {
                    try {
                        const invites = await fetchTeamInvites(teamId);
                        return { teamId, invites, error: null as string | null };
                    } catch (error) {
                        console.error(`Failed to load invites for team ${teamId}:`, error);
                        return {
                            teamId,
                            invites: [] as TeamPendingInvite[],
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Failed to load pending invites.",
                        };
                    }
                })
            );

            if (!isMounted) {
                return;
            }

            setTeamInvitesById((current) => {
                const next = { ...current };
                results.forEach(({ teamId, invites }) => {
                    next[teamId] = invites;
                });
                return next;
            });
            setInviteErrorsByTeamId((current) => {
                const next = { ...current };
                results.forEach(({ teamId, error }) => {
                    if (error) {
                        next[teamId] = error;
                    } else {
                        delete next[teamId];
                    }
                });
                return next;
            });
            setLoadingInviteTeamIds((current) => {
                const next = new Set(current);
                teamIds.forEach((teamId) => next.delete(teamId));
                return next;
            });
        }

        loadInvitesForPage();

        return () => {
            isMounted = false;
        };
    }, [canManageTeams, paginatedTeamIdKey]);

    useEffect(() => {
        const capstoneIds = paginatedCapstoneIdKey
            ? paginatedCapstoneIdKey
                  .split(",")
                  .map(Number)
                  .filter((capstoneId) => Number.isInteger(capstoneId) && capstoneId > 0)
            : [];

        if (!canManageTeams || capstoneIds.length === 0) {
            return;
        }

        let isMounted = true;
        const capstoneIdStrings = capstoneIds.map(String);
        setLoadingMentorCapstoneIds((current) => {
            const next = new Set(current);
            capstoneIdStrings.forEach((capstoneId) => next.add(capstoneId));
            return next;
        });

        async function loadMentorSupportForPage() {
            try {
                const mentors = await fetchActiveMentors();
                if (isMounted) {
                    setActiveMentors(mentors);
                }
            } catch (error) {
                console.error("Failed to load active mentors:", error);
                if (isMounted) {
                    setActiveMentors([]);
                }
            }

            const results = await Promise.all(
                capstoneIds.map(async (capstoneId) => {
                    try {
                        const data = await fetchCapstoneMentorRequests(capstoneId);
                        return {
                            capstoneId: String(capstoneId),
                            requests: data.requests,
                            support: data.support_summary,
                            error: null as string | null,
                        };
                    } catch (error) {
                        console.error(
                            `Failed to load mentor support for capstone ${capstoneId}:`,
                            error
                        );
                        return {
                            capstoneId: String(capstoneId),
                            requests: [] as MentorRequest[],
                            support: {} as CapstoneSupportSummary,
                            error:
                                error instanceof Error
                                    ? error.message
                                    : "Failed to load mentor support.",
                        };
                    }
                })
            );

            if (!isMounted) return;

            setMentorRequestsByCapstoneId((current) => {
                const next = { ...current };
                results.forEach(({ capstoneId, requests }) => {
                    next[capstoneId] = requests;
                });
                return next;
            });
            setSupportByCapstoneId((current) => {
                const next = { ...current };
                results.forEach(({ capstoneId, support }) => {
                    next[capstoneId] = support;
                });
                return next;
            });
            setMentorErrorsByCapstoneId((current) => {
                const next = { ...current };
                results.forEach(({ capstoneId, error }) => {
                    if (error) {
                        next[capstoneId] = error;
                    } else {
                        delete next[capstoneId];
                    }
                });
                return next;
            });
            setLoadingMentorCapstoneIds((current) => {
                const next = new Set(current);
                capstoneIdStrings.forEach((capstoneId) => next.delete(capstoneId));
                return next;
            });
        }

        loadMentorSupportForPage();

        return () => {
            isMounted = false;
        };
    }, [canManageTeams, paginatedCapstoneIdKey]);

    useEffect(() => {
        if (!canManageTeams) {
            return;
        }

        let isMounted = true;

        const memberIdPattern = /^\d+$/;
        const convertMemberObject = (
            member: MemberRecord | UserRecord | null | undefined
        ): string | null => {
            if (!member) {
                return null;
            }

            if (member.email) {
                return member.email;
            }

            const parts = [
                member.first_name ?? member.firstName,
                member.last_name ?? member.lastName,
            ].filter(Boolean);

            if (parts.length > 0) {
                return parts.join(" ");
            }

            return (
                member.full_name ??
                member.fullName ??
                member.name ??
                member.username ??
                null
            );
        };

        const convertCapstoneObject = (
            capstone: CapstoneRecord | null | undefined
        ): string | null => {
            if (!capstone) {
                return null;
            }

            return (
                capstone.title ??
                capstone.name ??
                capstone.project_title ??
                capstone.projectTitle ??
                null
            );
        };

        const getCapstoneStatus = (
            capstone: CapstoneRecord | null | undefined
        ): string | null => {
            return typeof capstone?.status === "string" && capstone.status.trim()
                ? capstone.status
                : null;
        };

        const extractUserRecord = (payload: unknown): UserRecord | null => {
            if (!payload || typeof payload !== "object") {
                return null;
            }

            const record = payload as Record<string, unknown>;
            const nested =
                record["data"] ??
                record["user"] ??
                record["profile"] ??
                record["result"];

            if (nested && typeof nested === "object") {
                return nested as UserRecord;
            }

            return record as UserRecord;
        };

        const memberCache = new Map<string, string | null>();
        const memberRequests = new Map<string, Promise<string | null>>();

        const fetchMemberName = async (
            memberId: string
        ): Promise<string | null> => {
            if (memberCache.has(memberId)) {
                const cachedValue = memberCache.get(memberId);
                return cachedValue ?? null;
            }

            if (memberRequests.has(memberId)) {
                return memberRequests.get(memberId)!;
            }

            const request = (async () => {
                try {
                    const payload = await fetchUserById(memberId);
                    const userRecord = extractUserRecord(payload);

                    const displayName = convertMemberObject(
                        userRecord ?? undefined
                    );

                    memberCache.set(memberId, displayName);
                    return displayName;
                } catch (err) {
                    console.error(
                        `Error fetching team member ${memberId}:`,
                        err
                    );
                    memberCache.set(memberId, null);
                    return null;
                } finally {
                    memberRequests.delete(memberId);
                }
            })();

            memberRequests.set(memberId, request);
            return request;
        };

        const resolveMemberEntry = async (
            entry: string | number | MemberRecord
        ): Promise<string | null> => {
            if (typeof entry === "number") {
                return fetchMemberName(entry.toString());
            }

            if (typeof entry === "string") {
                const trimmed = entry.trim();
                if (!trimmed) {
                    return null;
                }

                if (memberIdPattern.test(trimmed)) {
                    return fetchMemberName(trimmed);
                }

                return trimmed;
            }

            if (entry && typeof entry === "object" && !Array.isArray(entry)) {
                return convertMemberObject(entry);
            }

            return null;
        };

        const deriveCapstoneTitle = (team: TeamRecord): string | null => {
            const immediateTitle =
                convertCapstoneObject(team.capstone ?? undefined) ??
                (typeof team.capstone_title === "string" &&
                team.capstone_title.trim().length > 0
                    ? team.capstone_title
                    : null) ??
                (typeof team.project_title === "string" &&
                team.project_title.trim().length > 0
                    ? team.project_title
                    : null);

            if (immediateTitle) {
                return immediateTitle;
            }

            return null;
        };

        const enrichTeamRecords = async (
            teamRecords: TeamRecord[]
        ): Promise<EnrichedTeamRecord[]> => {
            return Promise.all(
                teamRecords.map(async (team) => {
                    const membersArray = Array.isArray(team.members)
                        ? team.members
                        : [];

                    const resolvedMembers = await Promise.all(
                        membersArray.map(resolveMemberEntry)
                    );
                    const cleanedMembers = resolvedMembers.filter(
                        (value): value is string => Boolean(value)
                    );

                    const capstoneTitle = deriveCapstoneTitle(team);
                    const capstoneStatus = getCapstoneStatus(team.capstone ?? undefined);

                    return {
                        ...team,
                        resolvedMembers:
                            cleanedMembers.length > 0 ? cleanedMembers : null,
                        resolvedCapstoneTitle: capstoneTitle ?? null,
                        resolvedCapstoneStatus: capstoneStatus ?? null,
                    };
                })
            );
        };

        const fetchTeamsDataFromApi = async () => {
            setLoading(true);
            setError(null);
            try {
                const payload = (await fetchTeams()) as
                    | TeamsApiResponse
                    | TeamRecord[];
                const results = Array.isArray(payload)
                    ? payload
                    : Array.isArray(payload?.data)
                    ? payload.data
                    : Array.isArray(payload?.teams)
                    ? payload.teams
                    : [];

                const enriched = await enrichTeamRecords(results ?? []);
                const filtered = (enriched ?? []).filter(
                    (team) => team.status !== "archived"
                );

                if (isMounted) {
                    setTeams(filtered);
                    setPage(1);
                }
            } catch (err) {
                console.error("Error fetching teams:", err);
                if (isMounted) {
                    setTeams([]);
                    setError("Could not load capstone teams.");
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchTeamsDataFromApi();

        return () => {
            isMounted = false;
        };
    }, [canManageTeams]);

    if (!canManageTeams) {
        return null;
    }

    const pickTeamKey = (team: EnrichedTeamRecord, index: number) => {
        const fallbackId =
            team.team_id ?? team.id ?? team.capstone_fk ?? `team-${index}`;

        return fallbackId;
    };

    const getTeamTitle = (team: EnrichedTeamRecord) => {
        if (team.resolvedCapstoneTitle) {
            return team.resolvedCapstoneTitle;
        }

        const capstone = team.capstone ?? null;
        if (capstone) {
            const inlineTitle =
                capstone.title ??
                capstone.name ??
                capstone.project_title ??
                capstone.projectTitle ??
                null;

            if (inlineTitle) {
                return inlineTitle;
            }
        }

        if (
            typeof team.capstone_title === "string" &&
            team.capstone_title.trim()
        ) {
            return team.capstone_title;
        }

        if (
            typeof team.project_title === "string" &&
            team.project_title.trim()
        ) {
            return team.project_title;
        }

        const teamId = team.team_id ?? team.id;
        return teamId ? `Team ${teamId}` : "Team without capstone";
    };

    const getLinkedStatus = (team: EnrichedTeamRecord) =>
        (
            team.resolvedCapstoneStatus ??
            team.capstone?.status ??
            team.status ??
            ""
        ).toLowerCase();

    const getTeamMeta = (team: EnrichedTeamRecord) => {
        if (getLinkedStatus(team) === "complete") {
            return "Complete";
        }
        if ((team.status || "").toLowerCase() === "finalized") {
            return "Finalized";
        }
        const statusLabel = formatStatusLabel(getLinkedStatus(team) || team.status);
        return statusLabel ?? null;
    };

    const isLockedTeam = (team: EnrichedTeamRecord) => {
        const status = getLinkedStatus(team);
        return (team.status || "").toLowerCase() === "finalized" ||
            status === "approved" ||
            status === "complete" ||
            status === "pending_review" ||
            status === "pending_admin_course_routing";
    };

    const buildFinalizationReadinessItems = (team: EnrichedTeamRecord | null): ReadinessItem[] => {
        if (!team) return [];
        const capstoneId = getCapstoneId(team);
        const capstoneKey = capstoneId !== null ? String(capstoneId) : "";
        const support = capstoneKey ? supportByCapstoneId[capstoneKey] : undefined;
        const supportLoading = capstoneKey
            ? loadingMentorCapstoneIds.has(capstoneKey)
            : false;
        const supportSatisfied =
            support?.requires_project_support === false || support?.has_support === true;
        const pendingCommitmentCount = Number(team.pending_commitment_request_count || 0);
        const unresolvedConfirmedCount = Number(team.mutually_confirmed_exploration_count || 0);
        const memberCount = getNumericTeamMemberIds(team).length;
        const leaderId = Number(team.leader_fk);
        const teamIdentityValid = memberCount > 0 && Number.isInteger(leaderId) && leaderId > 0;
        const officialMembers = Array.isArray(team.member_details) ? team.member_details : [];
        const enrollmentCoursesValid =
            officialMembers.length > 0 &&
            officialMembers.every((member) =>
                memberHasReadyEnrollmentCourse(member, courseMap)
            );

        return [
            {
                label: "Capstone approved for recruiting",
                ready: getLinkedStatus(team) === "approved_recruiting",
                detail:
                    getLinkedStatus(team) === "approved_recruiting"
                        ? "Instructor review has approved this project for recruiting."
                        : "Only approved recruiting projects can be finalized.",
            },
            {
                label: "Required support satisfied",
                ready: supportSatisfied,
                detail: supportLoading
                    ? "Checking mentor and external partner support..."
                    : supportSatisfied
                      ? "Mentor/external partner support is attached or not required."
                      : "Attach an accepted mentor or confirmed external partner first.",
            },
            {
                label: "No pending staff routing",
                ready: pendingCommitmentCount === 0,
                detail:
                    pendingCommitmentCount === 0
                        ? "No final commitment routing is waiting on staff."
                        : `${pendingCommitmentCount} commitment routing item${pendingCommitmentCount === 1 ? "" : "s"} must be resolved first.`,
            },
            {
                label: "No unresolved confirmed explorations",
                ready: unresolvedConfirmedCount === 0,
                detail:
                    unresolvedConfirmedCount === 0
                        ? "No mutually confirmed exploration is still awaiting commitment resolution."
                        : "Resolve mutually confirmed explorations before finalizing.",
            },
            {
                label: "Team identity valid",
                ready: teamIdentityValid,
                detail: teamIdentityValid
                    ? "The team has confirmed members and a leader."
                    : "A finalized team needs at least one member and a leader.",
            },
            {
                label: "Official enrollment courses valid",
                ready: enrollmentCoursesValid,
                detail: enrollmentCoursesValid
                    ? "Every official member has an active staffed enrollment course."
                    : "Each official member needs an active staffed enrollment course before finalization.",
            },
        ];
    };

    const formatMembers = (team: EnrichedTeamRecord) => {
        if (
            Array.isArray(team.resolvedMembers) &&
            team.resolvedMembers.length > 0
        ) {
            return team.resolvedMembers;
        }

        const members = Array.isArray(team.members) ? team.members : [];
        if (members.length === 0) {
            return null;
        }

        const normalized = members
            .map((member) => {
                if (typeof member === "string") {
                    const trimmed = member.trim();
                    if (!trimmed || /^\d+$/.test(trimmed)) {
                        return null;
                    }
                    return trimmed;
                }

                if (typeof member === "number") {
                    return null;
                }

                if (member && typeof member === "object") {
                    const candidate = member as MemberRecord;
                    if (candidate.email) {
                        return candidate.email;
                    }

                    const parts = [
                        candidate.first_name ?? candidate.firstName,
                        candidate.last_name ?? candidate.lastName,
                    ].filter(Boolean);

                    if (parts.length > 0) {
                        return parts.join(" ");
                    }

                    return (
                        candidate.full_name ??
                        candidate.fullName ??
                        candidate.name ??
                        candidate.username ??
                        null
                    );
                }

                return null;
            })
            .filter((value): value is string => Boolean(value));

        return normalized.length > 0 ? normalized : null;
    };

    const handleDeleteTeam = async () => {
        const teamId = teamToDelete?.team_id ?? teamToDelete?.id;
        if (!teamId) return;
        const trimmedReason = deleteReason.trim();
        if (!trimmedReason) {
            setError("Team disband requires an audit reason.");
            return;
        }
        try {
            setDeletingTeamId(teamId);
            await deleteTeam(Number(teamId), trimmedReason);
            setTeams((current) =>
                current.filter((candidate) => {
                    const candidateId = candidate.team_id ?? candidate.id;
                    return String(candidateId) !== String(teamId);
                })
            );
            setTeamToDelete(null);
            setDeleteReason("");
        } catch (err) {
            console.error("Failed to disband team:", err);
            setError(err instanceof Error ? err.message : "Failed to disband team.");
        } finally {
            setDeletingTeamId(null);
        }
    };

    const handleReassignLeader = async () => {
        if (!teamToReassign) return;
        const teamId = Number(teamToReassign.team_id ?? teamToReassign.id);
        const eligibleLeaderIds = getEligibleLeaderIds(teamToReassign);
        if (eligibleLeaderIds.length === 0) {
            setError("Need at least one non-leader member to reassign leadership.");
            return;
        }
        const parsedLeaderId = Number(newLeaderId);
        if (
            !Number.isInteger(parsedLeaderId) ||
            !eligibleLeaderIds.includes(parsedLeaderId)
        ) {
            setError("New leader must be one of the current non-leader members.");
            return;
        }
        const trimmedReason = reassignReason.trim();
        if (!trimmedReason) {
            setError("Leader reassignment requires an audit reason.");
            return;
        }
        try {
            setReassigningTeamId(teamId);
            await reassignLeader(teamId, parsedLeaderId, trimmedReason);
            setTeams((current) =>
                current.map((team) => {
                    const currentTeamId = Number(team.team_id ?? team.id);
                    return currentTeamId === teamId
                        ? { ...team, leader_fk: parsedLeaderId }
                        : team;
                })
            );
            setTeamToReassign(null);
            setNewLeaderId("");
            setReassignReason("");
        } catch (err) {
            console.error("Failed to reassign leader:", err);
            setError(err instanceof Error ? err.message : "Failed to reassign leader.");
        } finally {
            setReassigningTeamId(null);
        }
    };

    const handleCompleteCapstone = async () => {
        if (!teamToComplete) return;
        const capstoneId = getCapstoneId(teamToComplete);
        if (capstoneId === null) return;
        const trimmedNotes = completionNotes.trim();
        if (!trimmedNotes) {
            setError("Completion notes are required when marking a capstone complete.");
            return;
        }
        try {
            setCompletingCapstoneId(capstoneId);
            const updated = await completeCapstone(capstoneId, {
                notes: trimmedNotes,
            });
            setTeams((current) =>
                current.map((team) => {
                    if (getCapstoneId(team) !== capstoneId) {
                        return team;
                    }
                    return {
                        ...team,
                        resolvedCapstoneStatus: "complete",
                        capstone: {
                            ...(team.capstone || {}),
                            ...(updated || {}),
                            status: "complete",
                        },
                    };
                })
            );
            setTeamToComplete(null);
            setCompletionNotes("");
        } catch (err) {
            console.error("Failed to mark capstone complete:", err);
            setError(
                err instanceof Error
                    ? err.message
                    : "Failed to mark capstone complete."
            );
        } finally {
            setCompletingCapstoneId(null);
        }
    };

    const handleStaffFinalizeTeam = async () => {
        if (!teamToFinalize) return;
        const teamId = Number(teamToFinalize.team_id ?? teamToFinalize.id);
        if (!Number.isInteger(teamId) || teamId <= 0) return;
        const trimmedReason = finalizationReason.trim();
        if (!trimmedReason) {
            setError("Staff finalization requires a reason.");
            return;
        }
        try {
            setFinalizingTeamId(teamId);
            await finalizeTeam(teamId, trimmedReason);
            setTeams((current) =>
                current.map((team) => {
                    const currentTeamId = Number(team.team_id ?? team.id);
                    if (currentTeamId !== teamId) {
                        return team;
                    }
                    return {
                        ...team,
                        status: "finalized",
                        resolvedCapstoneStatus: "approved",
                        capstone: {
                            ...(team.capstone || {}),
                            status: "approved",
                        },
                    };
                })
            );
            setTeamToFinalize(null);
            setFinalizationReason("");
        } catch (err) {
            console.error("Failed to finalize team:", err);
            setError(err instanceof Error ? err.message : "Failed to finalize team.");
        } finally {
            setFinalizingTeamId(null);
        }
    };

    const handleRevokeInvite = async (teamId: number, inviteId: string) => {
        try {
            setRevokingInviteId(inviteId);
            setInviteErrorsByTeamId((current) => {
                const next = { ...current };
                delete next[teamId];
                return next;
            });
            await revokeInvite(inviteId);
            setTeamInvitesById((current) => ({
                ...current,
                [teamId]: (current[teamId] || []).filter(
                    (invite) => invite.invite_id !== inviteId
                ),
            }));
        } catch (err) {
            console.error("Failed to revoke invite:", err);
            setInviteErrorsByTeamId((current) => ({
                ...current,
                [teamId]: err instanceof Error ? err.message : "Failed to revoke invite.",
            }));
        } finally {
            setRevokingInviteId(null);
        }
    };

    const refreshMentorSupport = async (capstoneId: number) => {
        const key = String(capstoneId);
        setLoadingMentorCapstoneIds((current) => new Set(current).add(key));
        try {
            const data = await fetchCapstoneMentorRequests(capstoneId);
            setMentorRequestsByCapstoneId((current) => ({
                ...current,
                [key]: data.requests,
            }));
            setSupportByCapstoneId((current) => ({
                ...current,
                [key]: data.support_summary,
            }));
            setMentorErrorsByCapstoneId((current) => {
                const next = { ...current };
                delete next[key];
                return next;
            });
        } catch (error) {
            console.error("Failed to refresh mentor support:", error);
            setMentorErrorsByCapstoneId((current) => ({
                ...current,
                [key]:
                    error instanceof Error
                        ? error.message
                        : "Failed to refresh mentor support.",
            }));
        } finally {
            setLoadingMentorCapstoneIds((current) => {
                const next = new Set(current);
                next.delete(key);
                return next;
            });
        }
    };

    const handleStaffRequestMentor = async (capstoneId: number) => {
        const key = String(capstoneId);
        const draft = mentorDraftsByCapstoneId[key] || {
            mentorId: NO_MENTOR,
            message: "",
        };
        if (draft.mentorId === NO_MENTOR) {
            setMentorErrorsByCapstoneId((current) => ({
                ...current,
                [key]: "Select a mentor before sending the request.",
            }));
            return;
        }

        setMentorActionKey(`request-${key}`);
        setMentorErrorsByCapstoneId((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        try {
            await requestMentor(capstoneId, {
                mentor_id: Number(draft.mentorId),
                message: draft.message.trim() || null,
            });
            setMentorDraftsByCapstoneId((current) => ({
                ...current,
                [key]: { mentorId: NO_MENTOR, message: "" },
            }));
            await refreshMentorSupport(capstoneId);
        } catch (error) {
            console.error("Failed to request mentor:", error);
            setMentorErrorsByCapstoneId((current) => ({
                ...current,
                [key]: error instanceof Error ? error.message : "Failed to request mentor.",
            }));
        } finally {
            setMentorActionKey(null);
        }
    };

    const handleStaffCancelMentorRequest = async (
        capstoneId: number,
        request: MentorRequest
    ) => {
        const key = String(capstoneId);
        setMentorActionKey(`cancel-${request.mentor_request_id}`);
        setMentorErrorsByCapstoneId((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        try {
            await cancelMentorRequest(request.mentor_request_id, {
                reason: "Course staff cancelled the mentor request.",
            });
            await refreshMentorSupport(capstoneId);
        } catch (error) {
            console.error("Failed to cancel mentor request:", error);
            setMentorErrorsByCapstoneId((current) => ({
                ...current,
                [key]:
                    error instanceof Error
                        ? error.message
                        : "Failed to cancel mentor request.",
            }));
        } finally {
            setMentorActionKey(null);
        }
    };

    const handleStaffDecideMentorOffer = async (
        capstoneId: number,
        request: MentorRequest,
        decision: "accept" | "decline"
    ) => {
        const key = String(capstoneId);
        setMentorActionKey(`${decision}-${request.mentor_request_id}`);
        setMentorErrorsByCapstoneId((current) => {
            const next = { ...current };
            delete next[key];
            return next;
        });
        try {
            await decideMentorOffer(request.mentor_request_id, {
                decision,
                response_note: null,
            });
            await refreshMentorSupport(capstoneId);
        } catch (error) {
            console.error("Failed to save mentor offer decision:", error);
            setMentorErrorsByCapstoneId((current) => ({
                ...current,
                [key]:
                    error instanceof Error
                        ? error.message
                        : "Failed to save mentor offer decision.",
            }));
        } finally {
            setMentorActionKey(null);
        }
    };

    return (
        <section className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                    Capstone Teams
                </h2>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                    <SelectTrigger className="w-full sm:w-[300px]">
                        <SelectValue placeholder="Filter by department" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Departments</SelectItem>
                        {departmentOptions.map((department) => (
                            <SelectItem key={department} value={department}>
                                {department}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            {loading ? (
                <p className="text-sm text-slate-600">Loading teams...</p>
            ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
            ) : teams.length === 0 ? (
                <p className="text-sm text-slate-600">
                    No capstone teams found.
                </p>
            ) : filteredTeams.length === 0 ? (
                <p className="text-sm text-slate-600">
                    No capstone teams match this department filter.
                </p>
            ) : (
                <>
                    <div className="grid gap-4 grid-cols-1">
                        {paginatedTeams.map((team, index) => {
                            const globalIndex = (page - 1) * pageSize + index;
                            const memberList = formatMembers(team);
                            const memberDetails = Array.isArray(team.member_details)
                                ? team.member_details
                                : [];
                            const teamKey = pickTeamKey(team, globalIndex);
                            const numericTeamId = getTeamId(team);
                            const meta = getTeamMeta(team);
                            const canDeleteTeam = true;
                            const canReassignLeader = !isLockedTeam(team);
                            const pendingInvites = numericTeamId
                                ? teamInvitesById[numericTeamId] || []
                                : [];
                            const inviteLoadError = numericTeamId
                                ? inviteErrorsByTeamId[numericTeamId]
                                : null;
                            const invitesLoading =
                                numericTeamId !== null &&
                                loadingInviteTeamIds.has(numericTeamId);
                            const numericCapstoneId = getCapstoneId(team);
                            const capstoneKey =
                                numericCapstoneId !== null ? String(numericCapstoneId) : "";
                            const mentorRequests = capstoneKey
                                ? mentorRequestsByCapstoneId[capstoneKey] || []
                                : [];
                            const support = capstoneKey
                                ? supportByCapstoneId[capstoneKey]
                                : undefined;
                            const supportError = capstoneKey
                                ? mentorErrorsByCapstoneId[capstoneKey]
                                : "";
                            const supportLoading =
                                Boolean(capstoneKey) &&
                                loadingMentorCapstoneIds.has(capstoneKey);
                            const acceptedMentor = support?.accepted_mentor;
                            const pendingMentorRequests = mentorRequests.filter(
                                (request) =>
                                    request.status === "pending" &&
                                    request.request_source !== "mentor_offer"
                            );
                            const pendingMentorOffers = mentorRequests.filter(
                                (request) =>
                                    request.status === "pending" &&
                                    request.request_source === "mentor_offer"
                            );
                            const blockedMentorIds = new Set(
                                mentorRequests
                                    .filter(
                                        (request) =>
                                            request.status === "pending" ||
                                            request.status === "accepted"
                                    )
                                    .map((request) => Number(request.mentor_fk))
                            );
                            const availableMentors = activeMentors.filter(
                                (mentor) => !blockedMentorIds.has(Number(mentor.user_id))
                            );
                            const mentorDraft = mentorDraftsByCapstoneId[capstoneKey] || {
                                mentorId: NO_MENTOR,
                                message: "",
                            };
                            const canRequestMentor =
                                numericCapstoneId !== null &&
                                canRequestMentorForTeam(team) &&
                                !acceptedMentor;
                            const canMarkComplete =
                                numericCapstoneId !== null &&
                                (team.status || "").toLowerCase() === "finalized" &&
                                getLinkedStatus(team) === "approved";
                            const canStaffFinalize =
                                numericTeamId !== null &&
                                numericCapstoneId !== null &&
                                (team.status || "").toLowerCase() !== "finalized" &&
                                getLinkedStatus(team) === "approved_recruiting";
                            const finalizationReadinessItems =
                                buildFinalizationReadinessItems(team);
                            const coordinatingCourse =
                                team.course_fk && courseMap[Number(team.course_fk)]
                                    ? courseMap[Number(team.course_fk)]
                                    : null;

                            return (
                                <Card
                                    key={teamKey}
                                    className="gap-0 rounded-lg border border-slate-200 bg-white p-0 shadow-sm transition hover:shadow-md"
                                >
                                    <div className="p-4 space-y-3">
                                        <CardTitle className="line-clamp-2 break-words text-lg leading-snug">
                                            {getTeamTitle(team)}
                                        </CardTitle>
                                        {meta && (
                                            <CardDescription className="break-words text-sm text-slate-600">
                                                {meta}
                                            </CardDescription>
                                        )}
                                        <p className="break-words text-xs text-slate-500">
                                            {coordinatingCourse
                                                ? `Coordinating course: ${coordinatingCourse.code} - ${coordinatingCourse.name}`
                                                : "Coordinating course: Unspecified"}
                                        </p>
                                        {coordinatingCourse && (
                                            <div className="flex flex-wrap gap-2 text-xs">
                                                {coordinatingCourse.department?.name && (
                                                    <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                                                        {coordinatingCourse.department.name}
                                                    </span>
                                                )}
                                                {coordinatingCourse.department?.faculty?.name && (
                                                    <span className="rounded bg-amber-50 px-2 py-0.5 text-amber-700">
                                                        {coordinatingCourse.department.faculty.name}
                                                    </span>
                                                )}
                                                {coordinatingCourse.ecosystem?.name && (
                                                    <span className="rounded bg-cyan-50 px-2 py-0.5 text-cyan-700">
                                                        {coordinatingCourse.ecosystem.name}
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                        {(memberDetails.length > 0 || memberList) && (
                                            <div className="space-y-1">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    Members
                                                </p>
                                                <ul className="flex flex-wrap gap-2 text-sm text-slate-700">
                                                    {memberDetails.length > 0
                                                        ? memberDetails.map((member, idx) => {
                                                              const department =
                                                                  getMemberDepartmentName(member);
                                                              const enrollmentCourse =
                                                                  getMemberEnrollmentCourseLabel(
                                                                      member
                                                                  );
                                                              return (
                                                                  <li
                                                                      key={`${teamKey}-member-detail-${member.user_id ?? idx}`}
                                                                      className="flex max-w-full flex-wrap items-center gap-1 rounded-md bg-slate-100 px-2 py-1"
                                                                  >
                                                                      <span className="break-all">
                                                                          {getMemberDisplayName(member) ||
                                                                              `User #${member.user_id ?? idx + 1}`}
                                                                      </span>
                                                                      {department && (
                                                                          <span className="rounded bg-white px-1.5 py-0.5 text-xs text-slate-600">
                                                                              {department}
                                                                          </span>
                                                                      )}
                                                                      {enrollmentCourse && (
                                                                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-xs text-emerald-700">
                                                                              Enrolled: {enrollmentCourse}
                                                                          </span>
                                                                      )}
                                                                  </li>
                                                              );
                                                          })
                                                        : memberList?.map((member, idx) => (
                                                             <li
                                                                 key={`${teamKey}-member-${idx}`}
                                                                 className="max-w-full break-all rounded-md bg-slate-100 px-2 py-1"
                                                             >
                                                                 {member}
                                                             </li>
                                                          ))}
                                                </ul>
                                            </div>
                                        )}
                                        {numericTeamId !== null && (
                                            <div className="space-y-2">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    Pending Invites
                                                </p>
                                                {invitesLoading ? (
                                                    <p className="text-sm text-slate-500">
                                                        Loading invites...
                                                    </p>
                                                ) : inviteLoadError ? (
                                                    <p className="text-sm text-red-600">
                                                        {inviteLoadError}
                                                    </p>
                                                ) : pendingInvites.length === 0 ? (
                                                    <p className="text-sm text-slate-500">
                                                        No pending invites.
                                                    </p>
                                                ) : (
                                                    <ul className="space-y-2">
                                                        {pendingInvites.map((invite) => {
                                                            const inviteeEmail =
                                                                invite.invitee?.email ??
                                                                `User #${invite.user_fk}`;
                                                            return (
                                                                <li
                                                                    key={invite.invite_id}
                                                                    className="flex items-center justify-between gap-2 rounded-md bg-slate-50 px-2 py-1 text-sm text-slate-700"
                                                                >
                                                                    <span className="min-w-0 break-all">
                                                                        {inviteeEmail}
                                                                    </span>
                                                                    <Button
                                                                        variant="outline"
                                                                        size="sm"
                                                                        onClick={() =>
                                                                            handleRevokeInvite(
                                                                                numericTeamId,
                                                                                invite.invite_id
                                                                            )
                                                                        }
                                                                        disabled={
                                                                            revokingInviteId ===
                                                                            invite.invite_id
                                                                        }
                                                                        className="h-7 text-xs"
                                                                    >
                                                                        {revokingInviteId ===
                                                                        invite.invite_id
                                                                            ? "Revoking..."
                                                                            : "Revoke"}
                                                                    </Button>
                                                                </li>
                                                            );
                                                        })}
                                                    </ul>
                                                )}
                                            </div>
                                        )}
                                        {numericCapstoneId !== null && (
                                            <FinalizationReadinessChecklist
                                                items={finalizationReadinessItems}
                                            />
                                        )}
                                        {numericCapstoneId !== null && (
                                            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    Project Support
                                                </p>
                                                {supportLoading ? (
                                                    <p className="text-sm text-slate-500">
                                                        Loading support...
                                                    </p>
                                                ) : (
                                                    <>
                                                        {supportError && (
                                                            <p className="text-sm text-red-600">
                                                                {supportError}
                                                            </p>
                                                        )}
                                                        {acceptedMentor ? (
                                                            <p className="rounded border border-emerald-100 bg-emerald-50 p-2 text-sm text-emerald-800">
                                                                Mentor:{" "}
                                                                <span className="break-all font-medium">
                                                                    {acceptedMentor.mentor_email ||
                                                                        `Mentor #${acceptedMentor.mentor_fk}`}
                                                                </span>
                                                            </p>
                                                        ) : support?.external_partner_support_confirmed ? (
                                                            <p className="rounded border border-emerald-100 bg-emerald-50 p-2 text-sm text-emerald-800">
                                                                External partner support confirmed.
                                                            </p>
                                                        ) : support?.requires_project_support === false ? (
                                                            <p className="rounded border border-slate-200 bg-white p-2 text-sm text-slate-600">
                                                                Support optional for this course.
                                                            </p>
                                                        ) : (
                                                            <p className="rounded border border-amber-100 bg-amber-50 p-2 text-sm text-amber-800">
                                                                Mentor or confirmed external partner required before finalization.
                                                            </p>
                                                        )}

                                                        {pendingMentorRequests.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-medium text-slate-500">
                                                                    Pending mentor requests
                                                                </p>
                                                                {pendingMentorRequests.map((request) => (
                                                                    <div
                                                                        key={request.mentor_request_id}
                                                                        className="flex flex-col gap-2 rounded border border-slate-200 bg-white p-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                                                                    >
                                                                        <span className="break-all text-slate-700">
                                                                            {request.mentor?.email ||
                                                                                `Mentor #${request.mentor_fk}`}
                                                                        </span>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            className="h-7 text-xs"
                                                                            onClick={() =>
                                                                                handleStaffCancelMentorRequest(
                                                                                    numericCapstoneId,
                                                                                    request
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                mentorActionKey ===
                                                                                `cancel-${request.mentor_request_id}`
                                                                            }
                                                                        >
                                                                            {mentorActionKey ===
                                                                            `cancel-${request.mentor_request_id}`
                                                                                ? "Cancelling..."
                                                                                : "Cancel"}
                                                                        </Button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {pendingMentorOffers.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-xs font-medium text-slate-500">
                                                                    Mentor offers
                                                                </p>
                                                                {pendingMentorOffers.map((request) => (
                                                                    <div
                                                                        key={request.mentor_request_id}
                                                                        className="rounded border border-blue-100 bg-blue-50 p-2 text-sm"
                                                                    >
                                                                        <p className="break-all font-medium text-slate-800">
                                                                            {request.mentor?.email ||
                                                                                `Mentor #${request.mentor_fk}`}
                                                                        </p>
                                                                        {request.message && (
                                                                            <p className="mt-1 text-xs text-slate-600">
                                                                                {request.message}
                                                                            </p>
                                                                        )}
                                                                        <div className="mt-2 flex gap-2">
                                                                            <Button
                                                                                size="sm"
                                                                                className="h-7 text-xs"
                                                                                onClick={() =>
                                                                                    handleStaffDecideMentorOffer(
                                                                                        numericCapstoneId,
                                                                                        request,
                                                                                        "accept"
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    mentorActionKey ===
                                                                                    `accept-${request.mentor_request_id}`
                                                                                }
                                                                            >
                                                                                {mentorActionKey ===
                                                                                `accept-${request.mentor_request_id}`
                                                                                    ? "Saving..."
                                                                                    : "Accept"}
                                                                            </Button>
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="h-7 text-xs"
                                                                                onClick={() =>
                                                                                    handleStaffDecideMentorOffer(
                                                                                        numericCapstoneId,
                                                                                        request,
                                                                                        "decline"
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    mentorActionKey ===
                                                                                    `decline-${request.mentor_request_id}`
                                                                                }
                                                                            >
                                                                                {mentorActionKey ===
                                                                                `decline-${request.mentor_request_id}`
                                                                                    ? "Saving..."
                                                                                    : "Decline"}
                                                                            </Button>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}

                                                        {canRequestMentor && (
                                                            <div className="grid gap-2 border-t border-slate-200 pt-2 md:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_auto] md:items-start">
                                                                <Select
                                                                    value={mentorDraft.mentorId}
                                                                    onValueChange={(value) =>
                                                                        setMentorDraftsByCapstoneId(
                                                                            (current) => ({
                                                                                ...current,
                                                                                [capstoneKey]: {
                                                                                    mentorId: value,
                                                                                    message:
                                                                                        current[capstoneKey]
                                                                                            ?.message || "",
                                                                                },
                                                                            })
                                                                        )
                                                                    }
                                                                    disabled={availableMentors.length === 0}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue placeholder="Select mentor" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value={NO_MENTOR}>
                                                                            Select mentor
                                                                        </SelectItem>
                                                                        {availableMentors.map((mentor) => (
                                                                            <SelectItem
                                                                                key={mentor.user_id}
                                                                                value={String(mentor.user_id)}
                                                                            >
                                                                                {mentorDirectoryLabel(mentor)}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                                <Textarea
                                                                    value={mentorDraft.message}
                                                                    onChange={(event) =>
                                                                        setMentorDraftsByCapstoneId(
                                                                            (current) => ({
                                                                                ...current,
                                                                                [capstoneKey]: {
                                                                                    mentorId:
                                                                                        current[capstoneKey]
                                                                                            ?.mentorId ||
                                                                                        NO_MENTOR,
                                                                                    message: event.target.value,
                                                                                },
                                                                            })
                                                                        )
                                                                    }
                                                                    placeholder="Optional note"
                                                                    rows={1}
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() =>
                                                                        handleStaffRequestMentor(
                                                                            numericCapstoneId
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        mentorDraft.mentorId === NO_MENTOR ||
                                                                        mentorActionKey ===
                                                                            `request-${capstoneKey}`
                                                                    }
                                                                >
                                                                    {mentorActionKey === `request-${capstoneKey}`
                                                                        ? "Sending..."
                                                                        : "Request Mentor"}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        )}
                                        {canDeleteTeam && (
                                            <div className="flex justify-end gap-2">
                                                {canMarkComplete && (
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => {
                                                            setTeamToComplete(team);
                                                            setCompletionNotes("");
                                                        }}
                                                        disabled={
                                                            completingCapstoneId !== null &&
                                                            String(completingCapstoneId) ===
                                                                String(numericCapstoneId)
                                                        }
                                                    >
                                                        {completingCapstoneId !== null &&
                                                        String(completingCapstoneId) ===
                                                            String(numericCapstoneId)
                                                            ? "Completing..."
                                                            : "Mark Complete"}
                                                    </Button>
                                                )}
                                                <Popover>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="gap-2"
                                                        >
                                                            <Menu className="h-4 w-4" />
                                                            More actions
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent align="end" className="w-56 p-2">
                                                        <div className="space-y-1">
                                                            {canStaffFinalize && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full justify-start"
                                                                    onClick={() => {
                                                                        setTeamToFinalize(team);
                                                                        setFinalizationReason("");
                                                                    }}
                                                                    disabled={
                                                                        finalizingTeamId !== null &&
                                                                        String(finalizingTeamId) ===
                                                                            String(team.team_id ?? team.id)
                                                                    }
                                                                >
                                                                    {finalizingTeamId !== null &&
                                                                    String(finalizingTeamId) ===
                                                                        String(team.team_id ?? team.id)
                                                                        ? "Finalizing..."
                                                                        : "Finalize Team"}
                                                                </Button>
                                                            )}
                                                            {canReassignLeader && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="w-full justify-start"
                                                                    onClick={() => {
                                                                        const eligibleLeaderIds =
                                                                            getEligibleLeaderIds(team);
                                                                        setTeamToReassign(team);
                                                                        setNewLeaderId(
                                                                            eligibleLeaderIds[0]?.toString() ??
                                                                                ""
                                                                        );
                                                                        setReassignReason("");
                                                                    }}
                                                                    disabled={
                                                                        reassigningTeamId !== null &&
                                                                        String(reassigningTeamId) ===
                                                                            String(team.team_id ?? team.id)
                                                                    }
                                                                >
                                                                    Reassign Leader
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="w-full justify-start text-red-700 hover:text-red-800"
                                                                onClick={() => {
                                                                    setTeamToDelete(team);
                                                                    setDeleteReason("");
                                                                }}
                                                                disabled={
                                                                    deletingTeamId !== null &&
                                                                    String(deletingTeamId) ===
                                                                        String(team.team_id ?? team.id)
                                                                }
                                                            >
                                                                Disband Team
                                                            </Button>
                                                        </div>
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                        )}
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                    {totalPages > 1 && (
                        <div className="flex justify-center items-center gap-4 mt-4">
                            <button
                                onClick={() =>
                                    setPage((current) =>
                                        Math.max(1, current - 1)
                                    )
                                }
                                disabled={page === 1 || loading}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                type="button"
                            >
                                Previous
                            </button>
                            <span className="text-sm text-slate-600">
                                Page {page} of {totalPages}
                            </span>
                            <button
                                onClick={() =>
                                    setPage((current) =>
                                        Math.min(totalPages, current + 1)
                                    )
                                }
                                disabled={page >= totalPages || loading}
                                className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                type="button"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}
            <Dialog
                open={!!teamToFinalize}
                onOpenChange={(open) => {
                    if (!open) {
                        setTeamToFinalize(null);
                        setFinalizationReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Finalize Team</DialogTitle>
                        <DialogDescription>
                            This closes recruiting for the team and makes the capstone read-only. Use this only when staff are finalizing on behalf of the team leader.
                        </DialogDescription>
                    </DialogHeader>
                    {teamToFinalize && (
                        <FinalizationReadinessChecklist
                            items={buildFinalizationReadinessItems(teamToFinalize)}
                        />
                    )}
                    <div className="space-y-1">
                        <Label htmlFor="staff-finalization-reason">
                            Reason
                        </Label>
                        <Textarea
                            id="staff-finalization-reason"
                            value={finalizationReason}
                            onChange={(event) =>
                                setFinalizationReason(event.target.value)
                            }
                            placeholder="Why is staff finalizing this team?"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setTeamToFinalize(null);
                                setFinalizationReason("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleStaffFinalizeTeam}
                            disabled={
                                !finalizationReason.trim() ||
                                (finalizingTeamId !== null &&
                                    String(finalizingTeamId) ===
                                        String(teamToFinalize?.team_id ?? teamToFinalize?.id ?? ""))
                            }
                        >
                            {finalizingTeamId !== null &&
                            String(finalizingTeamId) ===
                                String(teamToFinalize?.team_id ?? teamToFinalize?.id ?? "")
                                ? "Finalizing..."
                                : "Finalize Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!teamToComplete}
                onOpenChange={(open) => {
                    if (!open) {
                        setTeamToComplete(null);
                        setCompletionNotes("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark Capstone Complete</DialogTitle>
                        <DialogDescription>
                            Confirm that this finalized capstone has reached the academic completion milestone. Completed projects can be published to WatMatch completed capstones during closeout.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1">
                        <Label htmlFor="capstone-completion-notes">
                            Completion notes
                        </Label>
                        <Textarea
                            id="capstone-completion-notes"
                            value={completionNotes}
                            onChange={(event) =>
                                setCompletionNotes(event.target.value)
                            }
                            placeholder="Required: summarize the academic completion evidence"
                            rows={3}
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setTeamToComplete(null);
                                setCompletionNotes("");
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCompleteCapstone}
                            disabled={
                                !completionNotes.trim() ||
                                (completingCapstoneId !== null &&
                                    String(completingCapstoneId) ===
                                        String(getCapstoneId(teamToComplete) ?? ""))
                            }
                        >
                            {completingCapstoneId !== null &&
                            String(completingCapstoneId) ===
                                String(getCapstoneId(teamToComplete) ?? "")
                                ? "Completing..."
                                : "Mark Complete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!teamToDelete}
                onOpenChange={(open) => {
                    if (!open) {
                        setTeamToDelete(null);
                        setDeleteReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Disband Team</DialogTitle>
                        <DialogDescription>
                            This closes the team, releases its members, and records
                            the reason.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1">
                        <Label htmlFor="team-delete-reason">Audit reason</Label>
                        <Input
                            id="team-delete-reason"
                            value={deleteReason}
                            onChange={(event) =>
                                setDeleteReason(event.target.value)
                            }
                            placeholder="Why is this team being disbanded?"
                        />
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setTeamToDelete(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteTeam}
                            disabled={
                                (deletingTeamId !== null &&
                                    String(deletingTeamId) ===
                                        String(teamToDelete?.team_id ?? teamToDelete?.id ?? "")) ||
                                !deleteReason.trim()
                            }
                        >
                            {deletingTeamId !== null &&
                            String(deletingTeamId) ===
                                String(teamToDelete?.team_id ?? teamToDelete?.id ?? "")
                                ? "Disbanding..."
                                : "Disband Team"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!teamToReassign}
                onOpenChange={(open) => {
                    if (!open) {
                        setTeamToReassign(null);
                        setNewLeaderId("");
                        setReassignReason("");
                    }
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Reassign Team Leader</DialogTitle>
                        <DialogDescription>
                            Choose a current non-leader member to become the team leader.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <Label htmlFor="new-leader-id">New Leader</Label>
                            <select
                                id="new-leader-id"
                                value={newLeaderId}
                                onChange={(event) =>
                                    setNewLeaderId(event.target.value)
                                }
                                className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                            >
                                {getEligibleLeaderIds(teamToReassign).length === 0 ? (
                                    <option value="">No eligible members</option>
                                ) : (
                                    getEligibleLeaderIds(teamToReassign).map((memberId) => (
                                        <option key={memberId} value={memberId}>
                                            {getMemberOptionLabel(teamToReassign, memberId)}
                                        </option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div className="space-y-1">
                            <Label htmlFor="reassign-reason">
                                Audit reason
                            </Label>
                            <Input
                                id="reassign-reason"
                                value={reassignReason}
                                onChange={(event) =>
                                    setReassignReason(event.target.value)
                                }
                                placeholder="Why is leadership changing?"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setTeamToReassign(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleReassignLeader}
                            disabled={
                                !newLeaderId.trim() ||
                                !reassignReason.trim() ||
                                getEligibleLeaderIds(teamToReassign).length === 0 ||
                                (reassigningTeamId !== null &&
                                    String(reassigningTeamId) ===
                                        String(
                                            teamToReassign?.team_id ??
                                                teamToReassign?.id ??
                                                ""
                                        ))
                            }
                        >
                            {reassigningTeamId !== null &&
                            String(reassigningTeamId) ===
                                String(teamToReassign?.team_id ?? teamToReassign?.id ?? "")
                                ? "Reassigning..."
                                : "Reassign"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
