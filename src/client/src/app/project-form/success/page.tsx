import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default function ProjectFormSuccessPage() {
    return (
        <div className="max-w-2xl mx-auto flex items-center justify-center min-h-full p-8">
            <Card className="text-center">
                <CardHeader className="pb-4">
                    <div className="flex justify-center mb-4">
                        <CheckCircle className="h-16 w-16 text-green-500" />
                    </div>
                    <CardTitle className="text-2xl text-green-700">
                        Form Submitted Successfully!
                    </CardTitle>
                    <CardDescription className="text-lg">
                        Your project submission has been received and is being
                        reviewed.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <p className="text-green-800">
                            Thank you for submitting your project! Your
                            instructor will review your submission and get back
                            to you.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
                        <Button asChild>
                            <Link href="/discover">Explore Other Projects</Link>
                        </Button>
                        <Button variant="outline" asChild>
                            <Link href="/dashboard">Go To Dashboard</Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
