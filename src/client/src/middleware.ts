import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const clerk = clerkMiddleware();
export default function middleware(...args: Parameters<typeof clerk>) {
    if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || !process.env.CLERK_SECRET_KEY) {
        return NextResponse.next();
    }
    return clerk(...args);
}

export const config = {
    matcher: ["/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)"],
};
