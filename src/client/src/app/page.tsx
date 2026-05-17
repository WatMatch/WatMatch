"use client";

import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WatMatchLanding() {
    return (
        <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-500">
            {/* Navbar is provided globally in the app layout */}

            {/* Hero Section */}
            <main className="flex flex-col items-center justify-center flex-1 text-center px-6 py-20 bg-card">
                <motion.h2
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="text-5xl md:text-6xl font-extrabold mb-6 text-primary"
                >
                    {"Canada's Largest Capstone Ecosystem"}
                </motion.h2>

                <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8 }}
                    className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10"
                >
                    Connect with innovative teams, mentors, and industry
                    partners across Canada to bring your final-year projects to
                    life.
                </motion.p>

                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                >
                    <Button
                        size="lg"
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-2xl px-8 py-6 text-lg"
                    >
                        Get Started
                    </Button>
                </motion.div>
            </main>

            {/* Feature Section */}
            <section id="features" className="py-20 bg-background">
                <div className="max-w-6xl mx-auto px-6 text-center">
                    <h3 className="text-3xl font-bold text-primary mb-12">
                        Why WatMatch?
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                title: "Team Collaboration",
                                desc: "Find and collaborate with students across disciplines and universities.",
                            },
                            {
                                title: "Mentorship Access",
                                desc: "Get guidance from industry professionals and professors to strengthen your project.",
                            },
                            {
                                title: "Industry Connections",
                                desc: "Pitch your capstone ideas to potential employers and startups.",
                            },
                        ].map((feature, i) => (
                            <Card
                                key={i}
                                className="bg-card border-border text-foreground shadow-sm hover:shadow-md transition"
                            >
                                <CardContent className="p-6">
                                    <h4 className="text-xl font-semibold mb-3 text-primary">
                                        {feature.title}
                                    </h4>
                                    <p className="text-muted-foreground">
                                        {feature.desc}
                                    </p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-6 border-t border-border text-center text-muted-foreground text-sm bg-card">
                © {new Date().getFullYear()} WatMatch. All rights reserved.
            </footer>
        </div>
    );
}
