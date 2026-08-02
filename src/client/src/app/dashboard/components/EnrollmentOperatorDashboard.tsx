"use client";

import { MarketplaceSettingsSection } from "./MarketplaceSettingsSection";
import { OperationsWorkbenchSection } from "./OperationsWorkbenchSection";
import { Disclosure, PageHeader, PageShell } from "@/components/ui/workspace";

export function EnrollmentOperatorDashboard() {
    return (
        <PageShell>
            <PageHeader
                eyebrow="Enrollment operations"
                title="Enrollment workbench"
                description="Clear routing and enrollment decisions, then coordinate the matching Registrar or Quest update outside WatMatch."
            />
            <OperationsWorkbenchSection />
            <Disclosure
                summary={
                    <span>
                        Marketplace cycle settings
                        <span className="ml-2 text-xs font-normal text-slate-500">
                            Term, phase, and transition controls
                        </span>
                    </span>
                }
            >
                <MarketplaceSettingsSection canEdit />
            </Disclosure>
        </PageShell>
    );
}
