"use client";

import { OperationsWorkbenchSection } from "./OperationsWorkbenchSection";
import { PageHeader, PageShell } from "@/components/ui/workspace";

export function AcademicAdvisorDashboard() {
    return (
        <PageShell>
            <PageHeader
                eyebrow="Academic advising"
                title="Routing workbench"
                description="Resolve the academic route decisions currently blocking students, rosters, and interdisciplinary projects."
            />
            <OperationsWorkbenchSection />
        </PageShell>
    );
}
