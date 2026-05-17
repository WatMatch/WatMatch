"use client";

import { useRef, useEffect, ReactNode } from "react";

interface BlurredScrollViewProps {
    children: ReactNode;
    className?: string;
}

export function BlurredScrollView({
    children,
    className = "",
}: BlurredScrollViewProps) {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollContainerRef.current?.scrollTo(0, 0);
    }, [children]);

    return (
        <div className={`relative overflow-hidden ${className}`}>
            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-slate-50 to-transparent pointer-events-none z-10" />

            <div
                ref={scrollContainerRef}
                className="overflow-auto h-full py-2 scrollbar-none"
            >
                <div className="flex flex-col gap-4 w-full max-w-6xl mx-auto pr-2">
                    {children}
                </div>
            </div>

            <div className="absolute bottom-0 left-0 w-full h-4 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none z-10" />
        </div>
    );
}
