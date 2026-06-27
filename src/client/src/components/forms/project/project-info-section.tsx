import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSectionProps } from "./types";
import { MultiSelect } from "@/components/ui/multiselect";
import { deliverableTypeOptions } from "./config";

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
                name="deliverableTypes"
                rules={{
                    required: "At least one deliverable type is required",
                    validate: (value) =>
                        (value && value.length > 0) ||
                        "At least one deliverable type is required",
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Deliverable Types{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <MultiSelect
                                options={deliverableTypeOptions.map((option) => ({
                                    label: option,
                                    value: option,
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Select deliverables..."
                                allowCustom
                                customLabel="Add deliverable"
                            />
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
                            Deliverable Details{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Describe relevant deliverables for problem definition and solution verification/validation."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

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

            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <FormField
                    control={control}
                    name="publicEvaluationAcknowledged"
                    rules={{
                        validate: (value) =>
                            value === true || "Public evaluation acknowledgement is required",
                    }}
                    render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(checked) => field.onChange(checked === true)}
                                />
                            </FormControl>
                            <div className="space-y-1">
                                <FormLabel className="text-sm font-medium">
                                    I understand the project may be evaluated in a public academic setting. <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="ipAcknowledged"
                    rules={{
                        validate: (value) =>
                            value === true || "IP policy acknowledgement is required",
                    }}
                    render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(checked) => field.onChange(checked === true)}
                                />
                            </FormControl>
                            <div className="space-y-1">
                                <FormLabel className="text-sm font-medium">
                                    I have reviewed the capstone IP policy expectations. <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="confidentialityAcknowledged"
                    rules={{
                        validate: (value) =>
                            value === true || "Confidentiality/NDA acknowledgement is required",
                    }}
                    render={({ field }) => (
                        <FormItem className="flex items-start gap-3 space-y-0">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(checked) => field.onChange(checked === true)}
                                />
                            </FormControl>
                            <div className="space-y-1">
                                <FormLabel className="text-sm font-medium">
                                    I understand NDA/confidentiality needs must be discussed before relying on private project material. <span className="text-red-500">*</span>
                                </FormLabel>
                                <FormMessage />
                            </div>
                        </FormItem>
                    )}
                />
            </div>
        </div>
    );
}
