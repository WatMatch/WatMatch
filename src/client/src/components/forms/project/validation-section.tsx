import {
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionProps } from "./types";

export function ValidationSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
            <FormField
                control={control}
                name="successCriteria"
                rules={{ required: "Success criteria are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Success Criteria <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="How will the team know the project succeeded?"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="validationPlan"
                rules={{ required: "Validation plan is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Validation Plan <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Describe how the solution will be tested, verified, or evaluated."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="stakeholders"
                rules={{ required: "Stakeholders/users are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Stakeholders / Users <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Who will use, support, review, or be affected by this project?"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="risksConstraints"
                rules={{ required: "Risks and constraints are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Risks, Constraints, Ethics, Safety, or Privacy{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Name constraints, safety/privacy considerations, approvals, data access, or other risks the team should plan around."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
