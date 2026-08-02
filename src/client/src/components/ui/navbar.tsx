"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
    const pathname = usePathname();
    const isLogin = pathname === "/login";
    const { isLoggedIn } = useAuth();
    const actionHref = isLogin ? "/" : isLoggedIn ? "/dashboard" : "/login";
    const actionLabel = isLogin ? "Back to overview" : isLoggedIn ? "Open workspace" : "Log in";
    return (
        <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-10">
                <Link href="/" className="inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2">
                    <Image src="/logo-horizontal.png" alt="WatMatch" width={142} height={32} className="h-auto w-[132px]" priority />
                </Link>
                <Button asChild variant="outline" size="sm">
                    <Link href={actionHref}>{actionLabel}</Link>
                </Button>
            </div>
        </header>
    );
}
