"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/workspace";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { buildApiUrl, readApiError } from "@/lib/api-client";

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { setUser } = userContext();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch(buildApiUrl("/api/v1/auth/login"), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });

            if (!response.ok) throw new Error(await readApiError(response, "Login failed"));

            const responseData = await response.json();
            localStorage.setItem("accessToken", responseData.data.access_token);
            localStorage.setItem("refreshToken", responseData.data.refresh_token);

            const user = responseData.data.user;
            setUser({
                user_id: user.user_id,
                email: user.email,
                course_fk: user.course_fk,
                role: user.role,
                course_active: user.course_active,
                course: user.course,
            });

            login();
            const normalizedRole = user.role?.toLowerCase();
            const destination = ["student", "instructor", "admin", "academic_advisor", "enrollment_operator", "mentor", "external_partner"].includes(normalizedRole)
                ? "/dashboard"
                : "/discover";
            setRedirecting(true);
            router.replace(destination);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            setRedirecting(false);
        } finally {
            setLoading(false);
        }
    };

    if (redirecting) {
        return (
            <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#f7f8fa] px-4" aria-live="polite">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-600"><Loader2 className="size-4 animate-spin" /> Opening your workspace…</div>
            </main>
        );
    }

    return (
        <main className="flex min-h-[calc(100dvh-4rem)] items-center justify-center bg-[#f7f8fa] px-5 py-12 sm:px-8">
            <section className="wm-panel w-full max-w-md p-6 sm:p-7">
                <h1 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950">Log in to WatMatch</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">Enter the email associated with your WatMatch account.</p>

                <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
                    {error && <Notice tone="danger" title="Could not log in">{error}</Notice>}
                    <div className="space-y-2">
                        <label htmlFor="email" className="text-sm font-medium text-slate-800">Email address</label>
                        <Input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            placeholder="you@uwaterloo.ca"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            disabled={loading}
                            required
                            autoFocus
                        />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : null}
                        {loading ? "Logging in…" : "Log in"}
                    </Button>
                </form>
            </section>
        </main>
    );
}
