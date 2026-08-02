import Link from "next/link";
import ProtectedRoute from "@/components/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Check, Clock3 } from "lucide-react";
import { BrowsePageShell } from "@/components/capstones/BrowsePage";

function ProjectFormSuccessContent() {
    return (
        <BrowsePageShell className="flex min-h-full items-center">
            <Card className="mx-auto w-full max-w-xl gap-0 p-0">
                <CardHeader className="border-b border-slate-100 bg-slate-50/60 px-5 py-5 sm:px-6">
                    <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <Check className="h-5 w-5" aria-hidden="true" />
                    </div>
                    <CardTitle className="text-xl text-slate-950">
                        Proposal submitted
                    </CardTitle>
                    <p className="text-sm leading-6 text-slate-600">
                        WatMatch received your capstone proposal.
                    </p>
                </CardHeader>
                <CardContent className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-blue-950">
                        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <div>
                            <p className="text-sm font-medium">What happens next</p>
                            <p className="mt-1 text-sm leading-6">
                                If the course route needs staff review, it will be resolved before the proposal reaches the coordinating instructor. Track updates from Home.
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                        <Button variant="outline" asChild>
                            <Link href="/discover">Browse projects</Link>
                        </Button>
                        <Button asChild>
                            <Link href="/dashboard">Go to Home</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </BrowsePageShell>
    );
}

export default function ProjectFormSuccessPage() {
    return (
        <ProtectedRoute>
            <ProjectFormSuccessContent />
        </ProtectedRoute>
    );
}
