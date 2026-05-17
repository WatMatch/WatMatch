"use client";

import ProjectForm from "./projectForm";
import { createCapstone } from "@/hooks/useCapstones";
import { useRouter } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ProjectFormValues } from "@/components/forms/project";
import { userContext } from "@/contexts/UserContext";

function ProjectFormPageContent() {
    const router = useRouter();
    const { user } = userContext();

    const handleSubmit = async (data: ProjectFormValues) => {
        try {
            if (!user?.course_fk) {
                throw new Error(
                    "Missing course information for the current user."
                );
            }

            const payload = {
                user_id: Number(user.user_id),
                title: data.projectTitle,
                description:
                    `${data.mainObjectives} ${data.deliverables} ${data.problemArea}`.trim(),
                course_id: Number(user.course_fk),
            };

            await createCapstone(payload);
            router.push("/project-form/success");
        } catch (error) {
            console.error("Failed to submit form:", error);
        }
    };

    return (
        <div className="min-h-full bg-slate-50 py-12 px-8">
            <div className="max-w-4xl mx-auto">
                <ProjectForm role={user?.role} onSubmit={handleSubmit} />
            </div>
        </div>
    );
}

export default function ProjectFormPage() {
    return (
        <ProtectedRoute>
            <ProjectFormPageContent />
        </ProtectedRoute>
    );
}
