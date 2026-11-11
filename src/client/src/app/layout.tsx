import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { UserProvider } from "@/contexts/UserContext";
import LayoutContent from "@/components/LayoutContent";

// Resolve server authentication configuration on each request, not at build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "WatMatch",
    description:
        "Creating Canada's largest capstone ecosystem for student teams, instructor review, past capstone discovery, and external partner opportunities.",
    icons: {
        icon: "/favicon.png",
        shortcut: "/favicon.png",
        apple: "/logo-favicon.png",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <head>
                <link rel="icon" href="/favicon.png" sizes="any" />
                <link rel="shortcut icon" href="/favicon.png" />
                <link rel="apple-touch-icon" href="/logo-favicon.png" />
            </head>
            <body className="flex min-h-dvh flex-col antialiased">
                <AuthProvider publishableKey={process.env.CLERK_SECRET_KEY ? process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY : undefined}>
                    <UserProvider>
                        <LayoutContent>{children}</LayoutContent>
                    </UserProvider>
                </AuthProvider>
            </body>
        </html>
    );
}
