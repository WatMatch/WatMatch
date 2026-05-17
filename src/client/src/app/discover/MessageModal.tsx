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

interface MessageModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description: string;
    message: string;
    onMessageChange: (message: string) => void;
    onSubmit: () => void;
    isSubmitting: boolean;
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
}: MessageModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="space-y-4">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <Textarea
                    value={message}
                    onChange={(e) => onMessageChange(e.target.value)}
                    placeholder="Your message…"
                    rows={6}
                    className="min-h-[160px]"
                />
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button onClick={onSubmit} disabled={isSubmitting}>
                        {isSubmitting ? "Sending…" : "Send Request"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
