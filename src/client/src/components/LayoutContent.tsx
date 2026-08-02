"use client";

import { useAuth } from "@/contexts/AuthContext";
import { userContext } from "@/contexts/UserContext";
import Navbar from "@/components/ui/navbar";
import Sidebar from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { ReactNode, useState } from "react";
import { usePathname } from "next/navigation";

export default function LayoutContent({ children }: { children: ReactNode }) {
    const { isLoggedIn, isInitialized } = useAuth();
    const { user } = userContext();
    const pathname = usePathname();
    const isAuthPage = pathname === "/login";
    const isPublicPage = pathname === "/" || isAuthPage;
    const workspaceHome = "/dashboard";
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    if (!isInitialized) {
        return (
            <div
                className="flex min-h-screen items-center justify-center gap-2 bg-slate-50 text-sm font-medium text-slate-600"
                role="status"
                aria-live="polite"
            >
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Opening WatMatch…
            </div>
        );
    }

    if (isLoggedIn && !isPublicPage) {
        if (!user) {
            return (
                <div
                    className="flex h-dvh items-center justify-center gap-2 bg-slate-50 px-4 text-sm font-medium text-slate-600"
                    role="status"
                    aria-live="polite"
                >
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Opening your workspace…
                </div>
            );
        }

        return (
            <div className="h-dvh overflow-hidden bg-[#f7f8fa] md:flex">
                <a
                    href="#main-content"
                    className="sr-only z-[100] rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
                >
                    Skip to content
                </a>
                <Sidebar className="hidden md:flex" />

                <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                    <div className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur md:hidden">
                        <Link
                            href={workspaceHome}
                            className="inline-flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2"
                        >
                            <Image
                                src="/logo-horizontal.png"
                                alt="WatMatch"
                                width={140}
                                height={32}
                                className="h-auto"
                                priority
                            />
                        </Link>
                        <DialogTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Open navigation"
                            >
                                <Menu className="h-5 w-5" />
                            </Button>
                        </DialogTrigger>
                    </div>

                    <DialogContent
                        aria-describedby={undefined}
                        showCloseButton={false}
                        className="left-0 top-0 h-dvh max-h-dvh w-[min(19rem,88vw)] max-w-none -translate-x-0 -translate-y-0 gap-0 overflow-hidden rounded-none border-y-0 border-l-0 bg-[#f4f6f8] p-0 shadow-2xl data-[state=open]:zoom-in-100 sm:max-w-none sm:p-0 md:hidden"
                    >
                        <DialogTitle className="sr-only">Navigation</DialogTitle>
                        <div className="flex h-16 items-center justify-end border-b border-slate-200/90 px-3">
                            <DialogClose asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    aria-label="Close navigation"
                                >
                                    <X className="h-5 w-5" />
                                </Button>
                            </DialogClose>
                        </div>
                        <Sidebar className="h-[calc(100dvh-4rem)] w-full border-r-0" onNavigate={() => setMobileNavOpen(false)} />
                    </DialogContent>
                </Dialog>

                <main
                    id="main-content"
                    tabIndex={-1}
                    className="h-full min-w-0 flex-1 overflow-y-auto pt-16 md:pt-0"
                >
                    <div className="min-h-full bg-[#f7f8fa] p-3 sm:p-5 lg:p-6">
                        {children}
                    </div>
                </main>
            </div>
        );
    }

    return (
        <>
            <a
                href="#main-content"
                className="sr-only z-[100] rounded-md bg-slate-950 px-3 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
            >
                Skip to content
            </a>
            <Navbar />
            <div id="main-content" tabIndex={-1} className="min-h-0 flex-1 overflow-auto">
                {children}
            </div>
        </>
    );
}
