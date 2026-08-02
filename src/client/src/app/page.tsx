"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WatMatchLanding() {
    return (
        <div className="flex min-h-screen flex-col bg-background text-foreground transition-colors duration-500">
            <main className="flex flex-1 flex-col items-center justify-center bg-card px-6 py-20 text-center">
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="mb-8"
                >
                    <Image
                        src="/logo-horizontal.png"
                        alt="WatMatch"
                        width={260}
                        height={59}
                        className="h-auto"
                        priority
                    />
                </motion.div>

                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-6 max-w-5xl text-4xl font-extrabold tracking-[-0.035em] text-primary md:text-5xl"
                >
                    Creating Canada&apos;s Largest Capstone Ecosystem
                </motion.h1>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="mb-10 max-w-2xl text-lg leading-8 text-muted-foreground md:text-xl"
                >
                    WatMatch helps students form teams, submit capstone ideas, browse
                    approved projects, and connect with optional external partners who
                    can support real capstone work.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    <Button asChild size="lg" className="px-8 text-base font-semibold">
                        <Link href="/login">Log in</Link>
                    </Button>
                </motion.div>
            </main>

            <section id="features" className="bg-background py-20">
                <div className="mx-auto max-w-6xl px-6 text-center">
                    <h2 className="mb-12 text-3xl font-bold text-primary">
                        What WatMatch Supports
                    </h2>
                    <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                        {[
                            {
                                title: "Student Teams",
                                desc: "Students can form teams, invite classmates, and manage capstone submissions.",
                            },
                            {
                                title: "External Partners",
                                desc: "Teams can connect with labs, hospitals, companies, nonprofits, and domain experts.",
                            },
                            {
                                title: "Instructor Review",
                                desc: "Instructors can approve, reject, or request changes for teams in their course.",
                            },
                        ].map((feature) => (
                            <Card key={feature.title} className="transition-shadow hover:shadow-md">
                                <CardContent className="p-6">
                                    <h3 className="mb-3 text-xl font-semibold text-primary">
                                        {feature.title}
                                    </h3>
                                    <p className="leading-6 text-muted-foreground">
                                        {feature.desc}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            <footer className="border-t border-border bg-card py-6 text-center text-sm text-muted-foreground">
                &copy; {new Date().getFullYear()} WatMatch. All rights reserved.
            </footer>
        </div>
    );
}
