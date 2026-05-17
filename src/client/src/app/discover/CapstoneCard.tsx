import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { UserPlus, Check } from "lucide-react";

interface Project {
    capstone_id: string;
    title?: string;
    description?: string;
    department?: string;
    year?: number;
}

interface CapstoneCardProps {
    project: Project;
    isInterested: boolean;
    onClick: () => void;
    onInterestClick: () => void;
}

export function CapstoneCard({
    project,
    isInterested,
    onClick,
    onInterestClick,
}: CapstoneCardProps) {
    return (
        <Card
            className="bg-white border border-slate-200 shadow-sm hover:shadow-md transition h-[200px] cursor-pointer"
            onClick={onClick}
        >
            <div className="flex flex-col h-full p-3">
                <CardTitle className="text-lg line-clamp-1">
                    {project.title}
                </CardTitle>

                <p className="text-slate-600 text-sm line-clamp-4 flex-grow">
                    {project.description}
                </p>

                <div className="flex items-center justify-between mt-2">
                    {(project.department || project.year) && (
                        <CardDescription className="text-xs">
                            {project.department && project.year
                                ? `${project.department} • ${project.year}`
                                : project.department || project.year}
                        </CardDescription>
                    )}

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onInterestClick();
                        }}
                        className={`p-1.5 rounded-md transition ${
                            isInterested
                                ? "bg-green-100 text-green-600 hover:bg-green-200"
                                : "hover:bg-slate-100 text-slate-600 hover:text-blue-500"
                        }`}
                    >
                        {isInterested ? (
                            <Check className="w-4 h-4" />
                        ) : (
                            <UserPlus className="w-4 h-4" />
                        )}
                    </button>
                </div>
            </div>
        </Card>
    );
}
