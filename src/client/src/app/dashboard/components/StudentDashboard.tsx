"use client";

import { useState, useRef } from "react";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Crown, UserPlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { userContext } from "@/contexts/UserContext";
import { useTeam, type TeamData } from "@/hooks/useTeam";
import { inviteTeammate } from "@/services/teams.service";
import {
    fetchStudentProfileById,
    type StudentProfile,
} from "@/services/users.service";

export function StudentDashboard() {
    const { user } = userContext();
    const {
        teams,
        pendingInterests,
        invites,
        loading,
        actionLoading,
        acceptStudent,
        rejectStudent,
        removeStudent,
        withdrawInterest,
        leaveTeam,
        acceptInvite,
        declineInvite,
    } = useTeam(user?.user_id);

    const [selectedTeam, setSelectedTeam] = useState<TeamData | null>(null);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState("");
    const [emailError, setEmailError] = useState("");
    const [inviteLoading, setInviteLoading] = useState(false);
    const [showStudentProfileModal, setShowStudentProfileModal] =
        useState(false);
    const [selectedStudentProfile, setSelectedStudentProfile] =
        useState<StudentProfile | null>(null);
    const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
    const [loadingStudentProfile, setLoadingStudentProfile] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const hasTeams = teams.length > 0;
    const hasInvites = invites.length > 0;
    const hasPendingInterests = pendingInterests.length > 0;

    const handleAcceptStudent = async (student_id: string, team_id: number) => {
        await acceptStudent(student_id, team_id);
        // Update selected team if modal is open
        if (selectedTeam?.team_id === team_id) {
            const updatedTeam = teams.find((t) => t.team_id === team_id);
            if (updatedTeam) setSelectedTeam(updatedTeam);
        }
    };

    const handleRejectStudent = async (student_id: string, team_id: number) => {
        await rejectStudent(student_id, team_id);
        if (selectedTeam?.team_id === team_id) {
            const updatedTeam = teams.find((t) => t.team_id === team_id);
            if (updatedTeam) setSelectedTeam(updatedTeam);
        }
    };

    const handleRemoveStudent = async (student_id: string, team_id: number) => {
        await removeStudent(student_id, team_id);
        if (selectedTeam?.team_id === team_id) {
            const updatedTeam = teams.find((t) => t.team_id === team_id);
            if (updatedTeam) setSelectedTeam(updatedTeam);
        }
    };

    const handleLeaveTeam = async (team_id: number) => {
        const result = await leaveTeam(team_id);
        if (result?.success) {
            setSelectedTeam(null);
        }
    };

    const handleOpenInviteModal = () => {
        setShowInviteModal(true);
        setInviteEmail("");
        setEmailError("");
    };

    const handleCloseInviteModal = () => {
        setShowInviteModal(false);
        setInviteEmail("");
        setEmailError("");
    };

    const validateEmail = (email: string): boolean => {
        if (!email) {
            setEmailError("Email is required");
            return false;
        }
        if (!email.endsWith("@uwaterloo.ca")) {
            setEmailError("Email must end with @uwaterloo.ca");
            return false;
        }
        setEmailError("");
        return true;
    };

    const handleViewStudentProfile = async (userId: string, email: string) => {
        setShowStudentProfileModal(true);
        setSelectedStudentEmail(email);
        setLoadingStudentProfile(true);
        setSelectedStudentProfile(null);

        try {
            const profile = await fetchStudentProfileById(userId);
            setSelectedStudentProfile(profile);
        } catch (error) {
            console.error("Failed to load student profile:", error);
        } finally {
            setLoadingStudentProfile(false);
        }
    };

    const handleInviteSubmit = async () => {
        if (!selectedTeam) return;

        if (validateEmail(inviteEmail)) {
            setInviteLoading(true);
            try {
                await inviteTeammate(selectedTeam.team_id, inviteEmail);
                handleCloseInviteModal();
            } catch (error) {
                console.error("Failed to send invite:", error);
                setEmailError("Failed to send invite. Please try again.");
            } finally {
                setInviteLoading(false);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <Loader2 className="w-8 h-8 animate-spin text-slate-600" />
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 py-4 px-8 flex flex-col">
            {/* Header */}
            <div className="flex flex-col md:flex-row gap-4 justify-center items-center mb-4 flex-[1]">
                <h1 className="text-3xl font-bold text-slate-900">
                    Student Dashboard
                </h1>
            </div>

            {/* Content */}
            <div className="relative flex-[20] overflow-hidden">
                {/* top fade */}
                <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-slate-50 to-transparent z-10 pointer-events-none" />

                <div
                    ref={scrollContainerRef}
                    className="overflow-auto h-full py-2 scrollbar-none"
                >
                    <div className="flex flex-col gap-4 w-full max-w-6xl mx-auto pr-2">
                        {/* CASE 1 & 3: USER HAS TEAM(S) */}
                        {hasTeams &&
                            teams.map((teamData, index) => (
                                <Card
                                    key={teamData.team_id}
                                    className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition w-full h-[240px] cursor-pointer"
                                    onClick={() => setSelectedTeam(teamData)}
                                >
                                    <div className="flex flex-col h-full p-6">
                                        <div className="flex-[1.2] mb-2 overflow-hidden flex items-center gap-2">
                                            <CardTitle className="text-lg line-clamp-1">
                                                {teamData.project
                                                    ? teamData.project.title
                                                    : `Team ${index + 1}`}
                                            </CardTitle>
                                        </div>

                                        <div className="flex-[3] overflow-hidden mb-2">
                                            <p className="text-slate-600 text-sm line-clamp-5">
                                                {teamData.project
                                                    ? teamData.project
                                                          .description
                                                    : "This team doesn't have a capstone project yet."}
                                            </p>
                                        </div>

                                        <div className="flex-[1] flex items-start justify-between gap-2 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <CardDescription className="text-xs">
                                                    {
                                                        teamData.team_members
                                                            .length
                                                    }{" "}
                                                    member
                                                    {teamData.team_members
                                                        .length !== 1
                                                        ? "s"
                                                        : ""}
                                                </CardDescription>
                                                {teamData.is_leader &&
                                                    teamData.interested_students
                                                        .length > 0 && (
                                                        <div className="relative flex items-center gap-1">
                                                            <span className="flex h-2 w-2">
                                                                {/* <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span> */}
                                                                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                                                            </span>
                                                            <CardDescription className="text-xs text-red-600 font-medium">
                                                                {
                                                                    teamData
                                                                        .interested_students
                                                                        .length
                                                                }{" "}
                                                                pending
                                                            </CardDescription>
                                                        </div>
                                                    )}
                                            </div>
                                            {teamData.project && (
                                                <span
                                                    className={`text-xs px-2 py-1 rounded whitespace-nowrap font-semibold ${
                                                        teamData.project.status.toLowerCase() ===
                                                        "approved"
                                                            ? "bg-green-100 text-green-700"
                                                            : teamData.project.status.toLowerCase() ===
                                                              "draft"
                                                            ? "bg-yellow-100 text-yellow-700"
                                                            : "bg-slate-100 text-slate-700"
                                                    }`}
                                                >
                                                    {teamData.project.status
                                                        .replace(/_/g, " ")
                                                        .toUpperCase()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}

                        {/* CASE 2: USER HAS PENDING INTERESTS */}
                        {!hasTeams && hasPendingInterests && (
                            <>
                                {pendingInterests.map((interest) => (
                                    <Card
                                        key={interest.team_id}
                                        className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition w-full h-[240px]"
                                    >
                                        <div className="flex flex-col h-full p-6">
                                            <div className="flex-[1.2] mb-2 overflow-hidden">
                                                <CardTitle className="text-lg line-clamp-1">
                                                    {interest.project_name}
                                                </CardTitle>
                                            </div>

                                            <div className="flex-[3] overflow-hidden mb-2">
                                                <p className="text-slate-600 text-sm line-clamp-4">
                                                    {interest.project_description ||
                                                        "No description available."}
                                                </p>
                                                {interest.message && (
                                                    <p className="text-slate-500 text-xs italic mt-1 line-clamp-1">
                                                        Your note:{" "}
                                                        {interest.message}
                                                    </p>
                                                )}
                                            </div>

                                            <div className="flex-[1] flex items-start justify-between gap-2 flex-wrap">
                                                <CardDescription className="text-xs">
                                                    Pending approval
                                                </CardDescription>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        withdrawInterest(
                                                            interest.capstone_id.toString()
                                                        );
                                                    }}
                                                    disabled={
                                                        actionLoading ===
                                                        `withdraw-${interest.capstone_id}`
                                                    }
                                                    className="text-xs h-7"
                                                >
                                                    {actionLoading ===
                                                    `withdraw-${interest.capstone_id}` ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        "Withdraw"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </>
                        )}

                        {/* TEAM INVITES SECTION */}
                        {hasInvites && (
                            <>
                                <div className="mt-6 mb-3">
                                    <h2 className="text-xl font-semibold text-slate-900">
                                        Team Invitations
                                    </h2>
                                    <p className="text-sm text-slate-500 mt-1">
                                        You've been invited to join these teams
                                    </p>
                                </div>
                                {invites.map((invite) => (
                                    <Card
                                        key={invite.invite_id}
                                        className="bg-white border border-blue-200 shadow-sm hover:shadow-md transition w-full h-[240px]"
                                    >
                                        <div className="flex flex-col h-full p-6">
                                            <div className="flex-[1.2] mb-2 overflow-hidden">
                                                <CardTitle className="text-lg line-clamp-1">
                                                    {invite.capstone.title ||
                                                        `Team ${invite.team_fk}`}
                                                </CardTitle>
                                            </div>

                                            <div className="flex-[3] overflow-hidden mb-2">
                                                <p className="text-slate-600 text-sm line-clamp-4">
                                                    {invite.capstone
                                                        .description ||
                                                        "No description available."}
                                                </p>
                                                <span
                                                    className={`inline-block mt-2 text-xs px-2 py-1 rounded font-semibold ${
                                                        invite.capstone.status.toLowerCase() ===
                                                        "approved"
                                                            ? "bg-green-100 text-green-700"
                                                            : invite.capstone.status.toLowerCase() ===
                                                              "draft"
                                                            ? "bg-yellow-100 text-yellow-700"
                                                            : "bg-slate-100 text-slate-700"
                                                    }`}
                                                >
                                                    {invite.capstone.status
                                                        .replace(/_/g, " ")
                                                        .toUpperCase()}
                                                </span>
                                            </div>

                                            <div className="flex-[1] flex items-start justify-end gap-2 flex-wrap">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        declineInvite(
                                                            invite.invite_id
                                                        );
                                                    }}
                                                    disabled={
                                                        actionLoading ===
                                                        `decline-${invite.invite_id}`
                                                    }
                                                    className="text-xs h-7"
                                                >
                                                    {actionLoading ===
                                                    `decline-${invite.invite_id}` ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        "Decline"
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="default"
                                                    size="sm"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        acceptInvite(
                                                            invite.invite_id
                                                        );
                                                    }}
                                                    disabled={
                                                        actionLoading ===
                                                        `accept-invite-${invite.invite_id}`
                                                    }
                                                    className="text-xs h-7"
                                                >
                                                    {actionLoading ===
                                                    `accept-invite-${invite.invite_id}` ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        "Accept"
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </Card>
                                ))}
                            </>
                        )}

                        {/* CASE 4: NO TEAM AND NO INTERESTS AND NO INVITES */}
                        {!hasTeams && !hasPendingInterests && !hasInvites && (
                            <Card className="bg-white border border-slate-200 shadow-sm w-full p-12 text-center">
                                <p className="text-slate-500 text-lg mb-2">
                                    You haven't joined any team or expressed
                                    interest in any projects yet.
                                </p>
                                <p className="text-slate-400">
                                    Browse available projects and express your
                                    interest to join a team!
                                </p>
                            </Card>
                        )}
                    </div>
                </div>

                {/* bottom fade */}
                <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-slate-50 to-transparent z-10 pointer-events-none" />
            </div>

            {/* Modal for Team Details */}
            <Dialog
                open={!!selectedTeam}
                onOpenChange={(open) => !open && setSelectedTeam(null)}
            >
                <DialogContent
                    className="
                        fixed z-50
                        left-1/2 top-1/2
                        -translate-x-1/2 -translate-y-1/2
                        w-full sm:max-w-5xl
                        h-auto max-h-[90vh]
                        overflow-y-auto
                        p-0 gap-0
                        rounded-2xl
                        bg-white
                        shadow-2xl
                        border border-slate-200
                        data-[state=open]:animate-in data-[state=closed]:animate-out
                        data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95
                        data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0
                    "
                >
                    {selectedTeam && (
                        <div className="flex flex-col h-full">
                            {/* HEADER */}
                            <div className="p-8 pr-12 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-start justify-between gap-4">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <DialogTitle className="text-2xl font-bold text-slate-900 leading-tight">
                                                {selectedTeam.project
                                                    ? selectedTeam.project.title
                                                    : `Team ${selectedTeam.team_id}`}
                                            </DialogTitle>
                                        </div>
                                        <div className="text-sm text-slate-500 font-medium">
                                            {selectedTeam.team_members.length}{" "}
                                            member
                                            {selectedTeam.team_members
                                                .length !== 1
                                                ? "s"
                                                : ""}
                                            {selectedTeam.is_leader &&
                                                selectedTeam.interested_students
                                                    .length > 0 && (
                                                    <>
                                                        {" "}
                                                        •{" "}
                                                        {
                                                            selectedTeam
                                                                .interested_students
                                                                .length
                                                        }{" "}
                                                        pending
                                                    </>
                                                )}
                                        </div>
                                    </div>
                                    {selectedTeam.project && (
                                        <span
                                            className={`shrink-0 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide border ${
                                                selectedTeam.project.status.toLowerCase() ===
                                                "approved"
                                                    ? "bg-green-100 text-green-700 border-green-200"
                                                    : selectedTeam.project.status.toLowerCase() ===
                                                      "draft"
                                                    ? "bg-yellow-100 text-yellow-700 border-yellow-200"
                                                    : "bg-slate-100 text-slate-700 border-slate-200"
                                            }`}
                                        >
                                            {selectedTeam.project.status
                                                .replace(/_/g, " ")
                                                .toUpperCase()}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* BODY */}
                            <div className="p-6 overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                    {/* LEFT COLUMN: Description */}
                                    <div className="md:col-span-2 space-y-6">
                                        <div>
                                            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider mb-3">
                                                About the Project
                                            </h3>
                                            {selectedTeam.project ? (
                                                <p className="text-slate-600 leading-relaxed whitespace-pre-wrap">
                                                    {
                                                        selectedTeam.project
                                                            .description
                                                    }
                                                </p>
                                            ) : (
                                                <p className="text-yellow-700 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                                                    ⚠️ This team doesn't have a
                                                    capstone project yet.
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2">
                                            {selectedTeam.is_leader && (
                                                <Button
                                                    variant="default"
                                                    onClick={
                                                        handleOpenInviteModal
                                                    }
                                                    className="w-full sm:w-auto"
                                                >
                                                    <UserPlus className="w-4 h-4 mr-2" />
                                                    Invite Teammate
                                                </Button>
                                            )}
                                            {!selectedTeam.is_leader && (
                                                <Button
                                                    variant="outline"
                                                    onClick={() =>
                                                        handleLeaveTeam(
                                                            selectedTeam.team_id
                                                        )
                                                    }
                                                    disabled={
                                                        actionLoading ===
                                                        "leave-team"
                                                    }
                                                    className="w-full sm:w-auto"
                                                >
                                                    {actionLoading ===
                                                    "leave-team" ? (
                                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                                    ) : null}
                                                    Leave Team
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* RIGHT COLUMN: Team Members & Interested Students */}
                                    <div className="space-y-6">
                                        {/* Team Members */}
                                        <div>
                                            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                Team Members
                                            </h3>
                                            <ul className="space-y-2">
                                                {(() => {
                                                    // Try to get leader_fk from backend, fallback to current user if they're the leader
                                                    let leaderUserId =
                                                        selectedTeam.leader_fk;

                                                    // Fallback: if leader_fk is missing but current user is the leader, use their ID
                                                    if (
                                                        !leaderUserId &&
                                                        selectedTeam.is_leader &&
                                                        user?.user_id
                                                    ) {
                                                        leaderUserId = parseInt(
                                                            user.user_id
                                                        );
                                                    }

                                                    console.log(
                                                        "👑 Leader identification:",
                                                        {
                                                            leader_fk:
                                                                selectedTeam.leader_fk,
                                                            leader_fk_type:
                                                                typeof selectedTeam.leader_fk,
                                                            team_id:
                                                                selectedTeam.team_id,
                                                            is_leader:
                                                                selectedTeam.is_leader,
                                                            current_user_id:
                                                                user?.user_id,
                                                            resolved_leader_id:
                                                                leaderUserId,
                                                            using_fallback:
                                                                !selectedTeam.leader_fk &&
                                                                selectedTeam.is_leader,
                                                        }
                                                    );

                                                    if (!leaderUserId) {
                                                        console.warn(
                                                            "⚠️ WARNING: Could not determine team leader!",
                                                            "leader_fk is missing from backend AND current user is not the leader.",
                                                            "The crown will not display."
                                                        );
                                                    }

                                                    console.log(
                                                        "👥 Team members:",
                                                        selectedTeam.team_members
                                                    );

                                                    // Sort members: leader first, then others
                                                    const sortedMembers = [
                                                        ...selectedTeam.team_members,
                                                    ].sort((a, b) => {
                                                        const aIsLeader =
                                                            parseInt(
                                                                a.user_id
                                                            ) === leaderUserId;
                                                        const bIsLeader =
                                                            parseInt(
                                                                b.user_id
                                                            ) === leaderUserId;
                                                        console.log(
                                                            `Comparing: ${a.user_id} (${aIsLeader}) vs ${b.user_id} (${bIsLeader})`
                                                        );
                                                        if (aIsLeader)
                                                            return -1;
                                                        if (bIsLeader) return 1;
                                                        return 0;
                                                    });

                                                    return sortedMembers.map(
                                                        (member) => {
                                                            const isCurrentUser =
                                                                member.user_id ===
                                                                user?.user_id;

                                                            // Convert both to numbers for comparison to avoid type mismatch
                                                            const memberIdNum =
                                                                parseInt(
                                                                    member.user_id
                                                                );
                                                            const leaderIdNum =
                                                                leaderUserId
                                                                    ? parseInt(
                                                                          String(
                                                                              leaderUserId
                                                                          )
                                                                      )
                                                                    : null;
                                                            const isLeaderMember =
                                                                leaderIdNum !==
                                                                    null &&
                                                                memberIdNum ===
                                                                    leaderIdNum;

                                                            console.log(
                                                                `Member ${member.email}: user_id=${member.user_id} (${memberIdNum}), isLeader=${isLeaderMember}, leaderUserId=${leaderUserId} (${leaderIdNum})`
                                                            );

                                                            return (
                                                                <li
                                                                    key={
                                                                        member.user_id
                                                                    }
                                                                    className="flex items-center justify-between text-sm text-slate-700 bg-slate-50 p-2 rounded border border-slate-100"
                                                                >
                                                                    <div className="flex items-center min-w-0 flex-1">
                                                                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500 mr-2 flex-shrink-0">
                                                                            {member.email
                                                                                .charAt(
                                                                                    0
                                                                                )
                                                                                .toUpperCase()}
                                                                        </div>
                                                                        <span className="truncate">
                                                                            {
                                                                                member.email
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    {isLeaderMember && (
                                                                        <Crown className="w-4 h-4 text-yellow-500 ml-2 flex-shrink-0" />
                                                                    )}
                                                                    {selectedTeam.is_leader &&
                                                                        !isCurrentUser && (
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="sm"
                                                                                onClick={() =>
                                                                                    handleRemoveStudent(
                                                                                        member.user_id,
                                                                                        selectedTeam.team_id
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    actionLoading ===
                                                                                    `remove-${member.user_id}`
                                                                                }
                                                                                className="ml-2 h-7 text-xs flex-shrink-0"
                                                                            >
                                                                                {actionLoading ===
                                                                                `remove-${member.user_id}` ? (
                                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                                ) : (
                                                                                    "Remove"
                                                                                )}
                                                                            </Button>
                                                                        )}
                                                                </li>
                                                            );
                                                        }
                                                    );
                                                })()}
                                            </ul>
                                        </div>

                                        {/* Interested Students (only for leaders) */}
                                        {selectedTeam.is_leader &&
                                            selectedTeam.interested_students
                                                .length > 0 && (
                                                <div>
                                                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                                                        Interested Students
                                                    </h3>
                                                    <ul className="space-y-3">
                                                        {selectedTeam.interested_students.map(
                                                            (student) => (
                                                                <li
                                                                    key={
                                                                        student.user_id
                                                                    }
                                                                    className="bg-blue-50 p-3 rounded border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors"
                                                                    onClick={() =>
                                                                        handleViewStudentProfile(
                                                                            student.user_id,
                                                                            student.email
                                                                        )
                                                                    }
                                                                >
                                                                    <div className="flex items-start justify-between mb-2">
                                                                        <div className="flex items-center min-w-0 flex-1">
                                                                            <div className="w-6 h-6 rounded-full bg-blue-200 flex items-center justify-center text-[10px] font-bold text-blue-700 mr-2 flex-shrink-0">
                                                                                {student.email
                                                                                    .charAt(
                                                                                        0
                                                                                    )
                                                                                    .toUpperCase()}
                                                                            </div>
                                                                            <span className="text-sm text-slate-700 truncate">
                                                                                {
                                                                                    student.email
                                                                                }
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    {student.message && (
                                                                        <p className="text-xs text-slate-600 italic mb-2 ml-8">
                                                                            "
                                                                            {
                                                                                student.message
                                                                            }
                                                                            "
                                                                        </p>
                                                                    )}
                                                                    <div
                                                                        className="flex gap-2 ml-8"
                                                                        onClick={(
                                                                            e
                                                                        ) =>
                                                                            e.stopPropagation()
                                                                        }
                                                                    >
                                                                        <Button
                                                                            size="sm"
                                                                            onClick={() =>
                                                                                handleAcceptStudent(
                                                                                    student.user_id,
                                                                                    selectedTeam.team_id
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actionLoading ===
                                                                                `accept-${student.user_id}`
                                                                            }
                                                                            className="h-7 text-xs flex-1"
                                                                        >
                                                                            {actionLoading ===
                                                                            `accept-${student.user_id}` ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : (
                                                                                "Accept"
                                                                            )}
                                                                        </Button>
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            onClick={() =>
                                                                                handleRejectStudent(
                                                                                    student.user_id,
                                                                                    selectedTeam.team_id
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                actionLoading ===
                                                                                `reject-${student.user_id}`
                                                                            }
                                                                            className="h-7 text-xs flex-1"
                                                                        >
                                                                            {actionLoading ===
                                                                            `reject-${student.user_id}` ? (
                                                                                <Loader2 className="w-3 h-3 animate-spin" />
                                                                            ) : (
                                                                                "Reject"
                                                                            )}
                                                                        </Button>
                                                                    </div>
                                                                </li>
                                                            )
                                                        )}
                                                    </ul>
                                                </div>
                                            )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Invite Teammate Modal */}
            <Dialog
                open={showInviteModal}
                onOpenChange={handleCloseInviteModal}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogTitle>Invite Teammate</DialogTitle>
                    <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            <Input
                                id="email"
                                type="email"
                                value={inviteEmail}
                                onChange={(e) => {
                                    setInviteEmail(e.target.value);
                                    setEmailError("");
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        handleInviteSubmit();
                                    }
                                }}
                                placeholder="student@uwaterloo.ca"
                            />
                            {emailError && (
                                <p className="text-sm text-red-600">
                                    {emailError}
                                </p>
                            )}
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={handleCloseInviteModal}
                                disabled={inviteLoading}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="default"
                                onClick={handleInviteSubmit}
                                disabled={inviteLoading}
                            >
                                {inviteLoading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Sending...
                                    </>
                                ) : (
                                    "Send Invite"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Student Profile Modal */}
            <Dialog
                open={showStudentProfileModal}
                onOpenChange={setShowStudentProfileModal}
            >
                <DialogContent className="sm:max-w-2xl">
                    <DialogTitle>Student Profile</DialogTitle>
                    {loadingStudentProfile ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                        </div>
                    ) : (
                        <div className="space-y-6 pt-4">
                            {/* Student Email */}
                            <div className="space-y-2">
                                <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                    Email
                                </Label>
                                <p className="text-sm text-slate-700">
                                    {selectedStudentEmail}
                                </p>
                            </div>

                            {/* About Me Section */}
                            {selectedStudentProfile?.about_me && (
                                <div className="space-y-2">
                                    <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                        About Me
                                    </Label>
                                    <p className="text-sm text-slate-700 whitespace-pre-wrap">
                                        {selectedStudentProfile.about_me}
                                    </p>
                                </div>
                            )}

                            {/* Skills Section */}
                            {selectedStudentProfile?.skills &&
                                selectedStudentProfile.skills.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-slate-500 text-xs font-semibold uppercase tracking-wider">
                                            Skills
                                        </Label>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedStudentProfile.skills.map(
                                                (skill) => (
                                                    <span
                                                        key={skill}
                                                        className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                                                    >
                                                        {skill}
                                                    </span>
                                                )
                                            )}
                                        </div>
                                    </div>
                                )}

                            {/* No Profile Message */}
                            {!selectedStudentProfile?.about_me &&
                                (!selectedStudentProfile?.skills ||
                                    selectedStudentProfile.skills.length ===
                                        0) && (
                                    <div className="text-center py-8 text-slate-500">
                                        This student hasn't set up their profile
                                        yet.
                                    </div>
                                )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
