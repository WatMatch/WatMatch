import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import LayoutContent from "@/components/LayoutContent";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "WatMatch",
    description:
        "Connect with innovative teams, mentors, and industry partners across Canada to bring your final-year projects to life.",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased h-screen flex flex-col`}
            >
                <AuthProvider>
                    <UserProvider>
                        <LayoutContent>{children}</LayoutContent>
                    </UserProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
