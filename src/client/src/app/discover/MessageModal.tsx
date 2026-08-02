import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    message: string;
    onMessageChange: (message: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
    submitLabel?: string;
}

export function MessageModal({
    isOpen,
    onClose,
    title,
    description,
    message,
    onMessageChange,
    onSubmit,
    isSubmitting,
    submitLabel = "Send Request",
}: MessageModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="gap-5 sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                    <Label htmlFor="project-action-message">Message <span className="font-normal text-slate-500">(optional)</span></Label>
                    <Textarea
                        id="project-action-message"
                        value={message}
                        onChange={(event) => onMessageChange(event.target.value)}
                        placeholder="Share useful context with the team"
                        rows={5}
                    />
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={onSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Saving…" : submitLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
