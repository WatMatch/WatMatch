"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { addMilestoneFeedback, listMilestoneFeedback, type FeedbackDraft, type MilestoneFeedback } from "@/services/milestone-feedback.service";

type Props = { capstoneId: number; canWrite: boolean };

export function MilestoneFeedbackSection(props: Props) {
    const [open, setOpen] = useState(false);
    if (process.env.NEXT_PUBLIC_MILESTONE_FEEDBACK_ENABLED !== "true") return null;
    return (
        <section aria-label="Milestone feedback" className="space-y-3">
            <Button type="button" variant="outline" aria-expanded={open} onClick={() => setOpen(!open)}>
                Milestone feedback
            </Button>
            {open && <FeedbackPanel {...props} />}
        </section>
    );
}

function FeedbackPanel({ capstoneId, canWrite }: Props) {
    const [entries, setEntries] = useState<MilestoneFeedback[] | null>(null);
    const [loadError, setLoadError] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [milestone, setMilestone] = useState("");
    const [comment, setComment] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saved, setSaved] = useState(false);
    const pending = useRef<FeedbackDraft | null>(null);

    useEffect(() => {
        let ignore = false;
        setLoadError("");
        listMilestoneFeedback(capstoneId)
            .then(result => { if (!ignore) setEntries(result); })
            .catch(err => { if (!ignore) setLoadError(err instanceof Error ? err.message : "Could not load feedback."); });
        return () => { ignore = true; };
    }, [capstoneId, attempt]);

    async function submit(event: FormEvent) {
        event.preventDefault();
        if (!canWrite || saving || !milestone.trim() || !comment.trim()) return;
        setSaving(true);
        setSaveError("");
        setSaved(false);
        try {
            // Reuse the ID when retrying an unchanged note after a lost response.
            if (!pending.current || pending.current.milestone !== milestone.trim() || pending.current.comment !== comment.trim()) {
                pending.current = { entry_id: crypto.randomUUID(), milestone: milestone.trim(), comment: comment.trim() };
            }
            const entry = await addMilestoneFeedback(capstoneId, pending.current);
            setEntries(items => [entry, ...(items || []).filter(item => item.entry_id !== entry.entry_id)]);
            setMilestone("");
            setComment("");
            pending.current = null;
            setSaved(true);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Could not record feedback.");
        } finally {
            setSaving(false);
        }
    }

    if (loadError) return <div role="alert">{loadError} <Button type="button" variant="outline" onClick={() => setAttempt(n => n + 1)}>Retry</Button></div>;
    if (!entries) return <p role="status">Loading feedback…</p>;
    return (
        <div className="space-y-4 rounded-md border p-4">
            {canWrite && <form onSubmit={submit} className="space-y-3">
                <p className="text-sm">Share a comment with this project team. Leave out grades and individual evaluations.</p>
                <label className="block text-sm">Milestone
                    <Input required maxLength={100} value={milestone} disabled={saving} onChange={e => { setMilestone(e.target.value); setSaved(false); }} />
                </label>
                <label className="block text-sm">Feedback
                    <Textarea required maxLength={2000} value={comment} disabled={saving} onChange={e => { setComment(e.target.value); setSaved(false); }} />
                </label>
                <Button type="submit" disabled={saving || !milestone.trim() || !comment.trim()}>{saving ? "Recording…" : "Record feedback"}</Button>
                {saveError && <p role="alert">{saveError}</p>}
                {saved && <p role="status">Feedback recorded.</p>}
            </form>}
            {entries.length === 0 ? <p className="text-sm">No milestone feedback yet.</p> : (
                <ul className="space-y-3">{entries.map(entry => (
                    <li key={entry.entry_id} className="border-t pt-3">
                        <strong>{entry.milestone}</strong>{" · "}
                        <time dateTime={entry.created_at}>{new Date(entry.created_at).toLocaleString()}</time>
                        <p className="whitespace-pre-wrap break-words">{entry.comment}</p>
                    </li>
                ))}</ul>
            )}
        </div>
    );
}
