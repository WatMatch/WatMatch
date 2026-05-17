import { useState, useEffect } from "react";
import { submitInterest as submitInterestService } from "@/services/interests.service";
import { fetchUserInterests } from "@/services/users.service";

export function useInterest() {
    const [interestedProjects, setInterestedProjects] = useState<Set<string>>(
        new Set()
    );
    const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function loadUserInterests() {
            try {
                const data = await fetchUserInterests();
                const projectIds = new Set(
                    (data.data || []).map((interest) =>
                        interest.capstone_id.toString()
                    )
                );
                setInterestedProjects(projectIds);
            } catch (err) {
                console.error("Error fetching user interests:", err);
            } finally {
                setIsLoading(false);
            }
        }

        loadUserInterests();
    }, []);

    const submitInterest = async (projectId: string, message: string) => {
        setIsSubmittingInterest(true);
        try {
            await submitInterestService(projectId, message);

            setInterestedProjects((prev) => {
                const copy = new Set(prev);
                if (copy.has(projectId)) {
                    copy.delete(projectId);
                } else {
                    copy.add(projectId);
                }
                return copy;
            });
            return { success: true };
        } catch (err) {
            console.error("Error sending interest:", err);
            return { success: false, error: err };
        } finally {
            setIsSubmittingInterest(false);
        }
    };

    return {
        interestedProjects,
        submitInterest,
        isSubmittingInterest,
        isLoading,
    };
}
