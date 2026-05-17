"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { buildApiUrl } from "@/lib/api-client";
import { userContext } from "@/contexts/UserContext";
import { fetchTeams } from "@/services/teams.service";
import { fetchCapstoneById } from "@/services/capstones.service";
import { fetchUserById } from "@/services/users.service";

interface MemberRecord {
    name?: string;
    first_name?: string;
    last_name?: string;
    firstName?: string;
    lastName?: string;
    full_name?: string;
    fullName?: string;
    username?: string;
    email?: string;
}

interface UserRecord extends MemberRecord {
    user_id?: string | number;
    id?: string | number;
}

interface CapstoneRecord {
    capstone_id?: string | number;
    id?: string | number;
    title?: string;
    name?: string;
    project_title?: string;
    projectTitle?: string;
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
    members?: Array<string | number | MemberRecord>;
    interested?: Array<string | number | MemberRecord>;
}

interface TeamsApiResponse {
    success?: boolean;
    data?: TeamRecord[];
    teams?: TeamRecord[];
}

interface EnrichedTeamRecord extends TeamRecord {
    resolvedMembers?: string[] | null;
    resolvedCapstoneTitle?: string | null;
}

const formatStatusLabel = (value?: string) => {
    if (!value) {
        return null;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

export function CapstoneTeamsSection() {
    const { user } = userContext();
    const normalizedRole = user?.role?.toLowerCase();
    const isInstructor = normalizedRole === "instructor";

    const [teams, setTeams] = useState<EnrichedTeamRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 5;

    const totalPages = useMemo(() => {
        const rawTotal = Math.ceil(teams.length / pageSize);
        return Math.max(1, Number.isNaN(rawTotal) ? 1 : rawTotal);
    }, [teams, pageSize]);

    const paginatedTeams = useMemo(() => {
        const safePage = Math.max(1, page);
        const start = (safePage - 1) * pageSize;
        return teams.slice(start, start + pageSize);
    }, [teams, page, pageSize]);

    useEffect(() => {
        if (page > totalPages) {
            setPage(totalPages);
        } else if (page < 1) {
            setPage(1);
        }
    }, [page, totalPages]);

    useEffect(() => {
        if (!isInstructor) {
            return;
        }

        let isMounted = true;

        const memberIdPattern = /^\d+$/;
        const capstoneIdPattern = /^\d+$/;

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

        const extractCapstoneRecord = (
            payload: unknown
        ): CapstoneRecord | null => {
            if (!payload || typeof payload !== "object") {
                return null;
            }

            const record = payload as Record<string, unknown>;
            const nested =
                record["data"] ??
                record["capstone"] ??
                record["result"] ??
                record["capstone_data"] ??
                record["capstoneInfo"];

            if (nested && typeof nested === "object") {
                return nested as CapstoneRecord;
            }

            return record as CapstoneRecord;
        };

        const memberCache = new Map<string, string | null>();
        const memberRequests = new Map<string, Promise<string | null>>();
        const capstoneCache = new Map<string, string | null>();
        const capstoneRequests = new Map<string, Promise<string | null>>();

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

        const fetchCapstoneTitle = async (
            capstoneId: string
        ): Promise<string | null> => {
            if (capstoneCache.has(capstoneId)) {
                const cachedValue = capstoneCache.get(capstoneId);
                return cachedValue ?? null;
            }

            if (capstoneRequests.has(capstoneId)) {
                return capstoneRequests.get(capstoneId)!;
            }

            if (!capstoneIdPattern.test(capstoneId)) {
                capstoneCache.set(capstoneId, null);
                return null;
            }

            const request = (async () => {
                try {
                    const payload = await fetchCapstoneById(capstoneId);
                    const capstoneRecord = extractCapstoneRecord(payload);
                    const title =
                        convertCapstoneObject(capstoneRecord ?? undefined) ??
                        (capstoneRecord?.capstone_id
                            ? `Capstone ${capstoneRecord.capstone_id}`
                            : null);

                    capstoneCache.set(capstoneId, title);
                    return title;
                } catch (err) {
                    console.error(
                        `Error fetching capstone ${capstoneId}:`,
                        err
                    );
                    capstoneCache.set(capstoneId, null);
                    return null;
                } finally {
                    capstoneRequests.delete(capstoneId);
                }
            })();

            capstoneRequests.set(capstoneId, request);
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

        const deriveCapstoneTitle = async (
            team: TeamRecord
        ): Promise<string | null> => {
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

            const capstoneIds = new Set<string>();
            const pushCapstoneId = (value?: string | number | null) => {
                if (value === undefined || value === null) {
                    return;
                }

                const normalized = String(value).trim();
                if (!normalized || !capstoneIdPattern.test(normalized)) {
                    return;
                }

                capstoneIds.add(normalized);
            };

            pushCapstoneId(team.capstone_fk);

            if (team.capstone) {
                pushCapstoneId(team.capstone.capstone_id);
                pushCapstoneId(team.capstone.id);
            }

            for (const capstoneId of capstoneIds) {
                const fetchedTitle = await fetchCapstoneTitle(capstoneId);
                if (fetchedTitle) {
                    return fetchedTitle;
                }
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

                    const capstoneTitle = await deriveCapstoneTitle(team);

                    return {
                        ...team,
                        resolvedMembers:
                            cleanedMembers.length > 0 ? cleanedMembers : null,
                        resolvedCapstoneTitle: capstoneTitle ?? null,
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
                const filtered = (enriched ?? []).filter((team) =>
                    Boolean(team.resolvedCapstoneTitle)
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
    }, [isInstructor]);

    if (!isInstructor) {
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

        return "Untitled Capstone";
    };

    const getTeamMeta = (team: EnrichedTeamRecord) => {
        const statusLabel = formatStatusLabel(team.status);
        return statusLabel ?? null;
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

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                    Capstone Teams
                </h2>
            </div>
            {loading ? (
                <p className="text-sm text-slate-600">Loading teams...</p>
            ) : error ? (
                <p className="text-sm text-red-600">{error}</p>
            ) : teams.length === 0 ? (
                <p className="text-sm text-slate-600">
                    No capstone teams found.
                </p>
            ) : (
                <>
                    <div className="grid gap-4 grid-cols-1">
                        {paginatedTeams.map((team, index) => {
                            const globalIndex = (page - 1) * pageSize + index;
                            const memberList = formatMembers(team);
                            const teamKey = pickTeamKey(team, globalIndex);
                            const meta = getTeamMeta(team);

                            return (
                                <Card
                                    key={teamKey}
                                    className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition"
                                >
                                    <div className="p-4 space-y-3">
                                        <CardTitle className="text-lg line-clamp-1">
                                            {getTeamTitle(team)}
                                        </CardTitle>
                                        {meta && (
                                            <CardDescription className="text-sm text-slate-600">
                                                {meta}
                                            </CardDescription>
                                        )}
                                        {memberList && (
                                            <div className="space-y-1">
                                                <p className="text-xs uppercase tracking-wide text-slate-500">
                                                    Members
                                                </p>
                                                <ul className="flex flex-wrap gap-2 text-sm text-slate-700">
                                                    {memberList.map(
                                                        (member, idx) => (
                                                            <li
                                                                key={`${teamKey}-member-${idx}`}
                                                                className="px-2 py-1 rounded-md bg-slate-100"
                                                            >
                                                                {member}
                                                            </li>
                                                        )
                                                    )}
                                                </ul>
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
        </section>
    );
}
