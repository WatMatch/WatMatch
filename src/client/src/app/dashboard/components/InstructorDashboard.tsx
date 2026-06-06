"use client";

import { useState } from "react";
import { userContext } from "@/contexts/UserContext";
import { PendingCapstonesSection } from "./PendingCapstonesSection";
import { CapstoneTeamsSection } from "./CapstoneTeamsSection";
import { AdminCoursesSection } from "./AdminCoursesSection";
import { AdminEnrollmentSection } from "./AdminEnrollmentSection";

export function InstructorDashboard() {
    const { user } = userContext();
    const isAdmin = (user?.role || "").toLowerCase() === "admin";
    const [activeTab, setActiveTab] = useState<
        "approvals" | "teams" | "courses" | "users"
    >("approvals");

    return (
        <div className="min-h-screen bg-slate-50 px-8">
            <div className="max-w-4xl mx-auto min-h-screen flex flex-col gap-6 py-8">
                <h1 className="text-3xl font-semibold text-slate-900">
                    {isAdmin ? "Admin Dashboard" : "Instructor Dashboard"}
                </h1>

                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
                    <button
                        type="button"
                        onClick={() => setActiveTab("approvals")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            activeTab === "approvals"
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        Approvals
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("teams")}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                            activeTab === "teams"
                                ? "bg-slate-900 text-white"
                                : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                        }`}
                    >
                        Teams
                    </button>
                    {isAdmin && (
                        <>
                            <button
                                type="button"
                                onClick={() => setActiveTab("courses")}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                    activeTab === "courses"
                                        ? "bg-slate-900 text-white"
                                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                Courses
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveTab("users")}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                    activeTab === "users"
                                        ? "bg-slate-900 text-white"
                                        : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                                }`}
                            >
                                Users
                            </button>
                        </>
                    )}
                </div>

                {activeTab === "approvals" ? (
                    <PendingCapstonesSection />
                ) : activeTab === "teams" ? (
                    <CapstoneTeamsSection />
                ) : activeTab === "courses" ? (
                    <AdminCoursesSection />
                ) : (
                    <AdminEnrollmentSection />
                )}
            </div>
        </div>
    );
}
