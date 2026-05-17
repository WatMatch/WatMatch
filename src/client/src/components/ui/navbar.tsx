"use client";

import Link from "next/link";
import * as React from "react";

export default function Navbar() {
    return (
        <header className="w-full py-4 px-8 flex justify-between items-center border-b border-border bg-background">
            <Link href="/" className="text-2xl font-bold text-primary">
                WatMatch
            </Link>
            <nav className="space-x-6">
                <Link
                    href="/login"
                    className="text-muted-foreground hover:text-primary transition"
                >
                    Login
                </Link>
            </nav>
        </header>
    );
}
