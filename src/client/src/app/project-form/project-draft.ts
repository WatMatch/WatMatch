import type { UseFormWatch } from "react-hook-form";
import type { ProjectFormValues } from "@/components/forms/project";

export interface StoredProjectDraft {
    version: 1;
    savedAt: string;
    values: Partial<ProjectFormValues>;
}

export function watchProjectDraft(
    watch: UseFormWatch<ProjectFormValues>,
    storageKey: string,
    onSaving: () => void,
    onSaved: (savedAt: string | null) => void
) {
    let pending: Partial<ProjectFormValues> | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function flush(report: boolean) {
        clearTimeout(timer);
        if (!pending) return;
        const draft: StoredProjectDraft = {
            version: 1,
            savedAt: new Date().toISOString(),
            values: pending,
        };
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(draft));
        } catch {
            if (report) onSaved(null);
            return;
        }
        pending = null;
        if (report) onSaved(draft.savedAt);
    }

    const subscription = watch((values, { name }) => {
        if (!name) return; // Restoring or resetting the form is not an edit.
        pending = values as Partial<ProjectFormValues>;
        clearTimeout(timer);
        onSaving();
        timer = setTimeout(() => flush(true), 500);
    });
    const onPageHide = () => flush(true);
    window.addEventListener("pagehide", onPageHide);

    return {
        clear() {
            clearTimeout(timer);
            pending = null;
            try {
                window.localStorage.removeItem(storageKey);
                return true;
            } catch {
                return false;
            }
        },
        dispose() {
            subscription.unsubscribe();
            window.removeEventListener("pagehide", onPageHide);
            flush(false);
        },
    };
}
