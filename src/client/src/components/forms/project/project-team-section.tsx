import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FormSectionProps } from "./types";
import { skills } from "./config";
import { MultiSelect } from "@/components/ui/multiselect";

export function ProjectTeamSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Project Team</h2>

            <FormField
                control={control}
                name="meetingFrequency"
                rules={{ required: "Meeting frequency is required" }}
                render={({ field: { value, onChange } }) => (
                    <FormItem>
                        <FormLabel>
                            Meeting Frequency{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <Select
                            onValueChange={onChange}
                            value={value as string}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select frequency" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="biweekly">
                                    Biweekly
                                </SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="skillsRequired"
                rules={{
                    required: "At least one skill is required",
                    validate: (value) =>
                        (value && value.length > 0) ||
                        "At least one skill is required",
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Skills <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <MultiSelect
                                options={skills.map((s) => ({
                                    label: s,
                                    value: s,
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Search and select skills..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
