import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { submitInterest as submitInterestService } from "@/services/interests.service";
import { fetchUserInterests } from "@/services/users.service";

export function useInterest(options: { enabled?: boolean } = {}) {
    const enabled = options.enabled !== false;
    const [interestMessages, setInterestMessages] = useState<Record<string, string>>(
        {}
    );
    const interestedProjects = useMemo(() => new Set(Object.keys(interestMessages)), [interestMessages]);
    const [isSubmittingInterest, setIsSubmittingInterest] = useState(false);
    const [isLoading, setIsLoading] = useState(enabled);
    const [historyError, setHistoryError] = useState<string | null>(null);
    // Keep submissions that finish while an older history read is in flight.
    const pendingLoad = useRef<Record<string, string> | null>(null);
    const [error, setError] = useState<string | null>(null);

    const getErrorMessage = (err: unknown, fallback: string) =>
        err instanceof Error ? err.message : fallback;

    const loadHistory = useCallback(async () => {
        if (!enabled || pendingLoad.current) return;
        const submittedDuringLoad: Record<string, string> = {};
        pendingLoad.current = submittedDuringLoad;
        setIsLoading(true);
        try {
            const { data } = await fetchUserInterests();
            if (pendingLoad.current !== submittedDuringLoad) return;
            const messages = Object.fromEntries(
                data.map((interest) => [String(interest.capstone_id), interest.message || ""])
            );
            setInterestMessages({ ...messages, ...submittedDuringLoad });
            setHistoryError(null);
        } catch {
            if (pendingLoad.current === submittedDuringLoad) {
                setHistoryError("Could not load your interest history.");
            }
        } finally {
            if (pendingLoad.current === submittedDuringLoad) {
                pendingLoad.current = null;
                setIsLoading(false);
            }
        }
    }, [enabled]);

    useEffect(() => {
        if (enabled) {
            void loadHistory();
        } else {
            setInterestMessages({});
            setHistoryError(null);
            setError(null);
            setIsLoading(false);
        }

        return () => { pendingLoad.current = null; };
    }, [enabled, loadHistory]);

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

            if (pendingLoad.current) pendingLoad.current[projectId] = message;
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
        historyError,
        retryHistory: loadHistory,
        error,
        clearError: () => setError(null),
    };
}
