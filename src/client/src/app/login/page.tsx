"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Card,
    CardHeader,
    CardTitle,
    CardDescription,
    CardContent,
} from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import { useState } from "react";
import { buildApiUrl, readApiError } from "@/lib/api-client";

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuth();
    const { setUser } = userContext();
    const [email, setEmail] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [redirecting, setRedirecting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);

        try {
            const response = await fetch(buildApiUrl("/api/v1/auth/login"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ email: email.trim().toLowerCase() }),
            });

            if (!response.ok) {
                throw new Error(await readApiError(response, "Login failed"));
            }

            const response_data = await response.json();

            // Store tokens
            localStorage.setItem(
                "accessToken",
                response_data.data.access_token
            );
            localStorage.setItem(
                "refreshToken",
                response_data.data.refresh_token
            );

            // Extract user data from response
            const user = response_data.data.user;
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
            const destination =
                normalizedRole === "instructor" || normalizedRole === "admin"
                    ? "/dashboard"
                    : "/discover";
            setRedirecting(true);
            router.replace(destination);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Login failed");
            console.error("Login error:", err);
            setRedirecting(false);
        } finally {
            setLoading(false);
        }
    };

    if (redirecting) {
        return (
            <div className="h-full bg-slate-50 flex items-center justify-center px-4">
                <div className="text-sm text-slate-600">Opening WatMatch...</div>
            </div>
        );
    }

    return (
        <div className="h-full bg-slate-50 flex items-center justify-center px-4">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">
                        Login to WatMatch
                    </CardTitle>
                    <CardDescription>
                        Enter your WatMatch email to access your account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        {error && (
                            <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                                {error}
                            </div>
                        )}
                        <div className="space-y-2">
                            <label
                                htmlFor="email"
                                className="text-sm font-medium"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="student@uwaterloo.ca"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                        <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                        >
                            {loading ? "Logging in..." : "Login"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
