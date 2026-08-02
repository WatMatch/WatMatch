import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionProps } from "./types";
import { MultiSelect } from "@/components/ui/multiselect";
import { taxonomyChipClassName } from "@/components/ui/taxonomy-chip";
import { deliverableTypeOptions } from "./config";

export function ProjectInfoSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
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
                                chipClassName={() => taxonomyChipClassName("deliverable")}
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

        </div>
    );
}
