"use client";

import { Suspense, useEffect } from "react";
import { SignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Notice } from "@/components/ui/workspace";

export default function LoginPage() {
    const { isConfigured, isInitialized, isLoggedIn } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (isInitialized && isLoggedIn) router.replace("/dashboard");
    }, [isInitialized, isLoggedIn, router]);

    return (
        <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#f7f8fa] px-4 py-12">
            <section className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <h1 className="text-2xl font-semibold text-slate-950">Sign in to WatMatch</h1>
                    <p className="mt-2 text-sm text-slate-600">Sign in with the email address registered for your WatMatch account. If you are unsure which address to use, ask the WatMatch team.</p>
                </div>
                {!isConfigured ? <Notice tone="danger" title="Sign-in is not available">Sign-in has not been configured for this environment. Please contact the WatMatch team.</Notice> : !isInitialized || isLoggedIn ? <p role="status" className="text-center text-sm text-slate-600">Opening sign-in…</p> : (
                    <Suspense fallback={<p role="status">Loading sign-in…</p>}>
                        <SignIn routing="hash" forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard" />
                    </Suspense>
                )}
            </section>
        </main>
    );
}
