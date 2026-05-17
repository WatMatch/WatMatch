"use client";

import { PendingCapstonesSection } from "./PendingCapstonesSection";
import { CapstoneTeamsSection } from "./CapstoneTeamsSection";

export function InstructorDashboard() {
    return (
        <div className="min-h-screen bg-slate-50 px-8">
            <div className="max-w-4xl mx-auto min-h-screen flex flex-col gap-6 py-8">
                <h1 className="text-3xl font-semibold text-slate-900">
                    Instructor Dashboard
                </h1>
                <PendingCapstonesSection />
                <hr className="border-slate-200" />
                <CapstoneTeamsSection />
            </div>
        </div>
    );
}
