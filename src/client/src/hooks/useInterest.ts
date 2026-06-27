import { useState, useEffect } from "react";
import { submitInterest as submitInterestService } from "@/services/interests.service";
import { fetchUserInterests } from "@/services/users.service";

export function useInterest(options: { enabled?: boolean } = {}) {
    const enabled = options.enabled !== false;
    const [interestedProjects, setInterestedProjects] = useState<Set<string>>(
        new Set()
    );
    const [interestMessages, setInterestMessages] = useState<Record<string, string>>(
        {}
    );
    const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const getErrorMessage = (err: unknown, fallback: string) =>
        err instanceof Error ? err.message : fallback;

    useEffect(() => {
        if (!enabled) {
            setInterestedProjects(new Set());
            setInterestMessages({});
            setError(null);
            setIsLoading(false);
            return;
        }

        async function loadUserInterests() {
            setIsLoading(true);
            try {
                const data = await fetchUserInterests();
                const messages: Record<string, string> = {};
                const projectIds = new Set(
                    (data.data || []).map((interest) => {
                        const projectId = interest.capstone_id.toString();
                        messages[projectId] = interest.message || "";
                        return projectId;
                    })
                );
                setInterestedProjects(projectIds);
                setInterestMessages(messages);
            } catch (err) {
                console.error("Error fetching user interests:", err);
            } finally {
                setIsLoading(false);
            }
        }

        loadUserInterests();
    }, [enabled]);

    const submitInterest = async (projectId: string, message: string) => {
        if (!enabled) {
            return {
                success: false,
                error: new Error("Interest requests are only available to students."),
            };
        }

        setIsSubmittingInterest(true);
        setError(null);
        try {
            await submitInterestService(projectId, message);

            setInterestedProjects((prev) => {
                const copy = new Set(prev);
                copy.add(projectId);
                return copy;
            });
            setInterestMessages((prev) => ({
                ...prev,
                [projectId]: message,
            }));
            return { success: true };
        } catch (err) {
            console.error("Error sending interest:", err);
            setError(getErrorMessage(err, "Could not send interest."));
            return { success: false, error: err };
        } finally {
            setIsSubmittingInterest(false);
        }
    };

    return {
        interestedProjects,
        interestMessages,
        submitInterest,
        isSubmittingInterest,
        isLoading,
        error,
        clearError: () => setError(null),
    };
}
