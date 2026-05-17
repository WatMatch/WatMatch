import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionProps } from "./types";

export function ProjectInfoSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Project Information</h2>

            <FormField
                control={control}
                name="problemArea"
                rules={{ required: "Problem area is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Problem Area <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="mainObjectives"
                rules={{ required: "Main objectives are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Main Objectives{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="scopeOfWork"
                rules={{ required: "Scope of work is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Scope of Work{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="deliverables"
                rules={{ required: "Deliverables are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Deliverables <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
