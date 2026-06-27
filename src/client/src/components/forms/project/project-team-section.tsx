import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
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
import { fetchSkills } from "@/services/skills.service";
import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

export function ProjectTeamSection({ control }: FormSectionProps) {
    const [skillOptions, setSkillOptions] = useState<string[]>(skills);

    useEffect(() => {
        let isMounted = true;
        async function loadSkills() {
            try {
                const rows = await fetchSkills();
                if (isMounted && rows.length > 0) {
                    setSkillOptions(rows.map((skill) => skill.name));
                }
            } catch (error) {
                console.error("Failed to load skills:", error);
            }
        }
        loadSkills();
        return () => {
            isMounted = false;
        };
    }, []);

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
                                <SelectItem value="end_of_term_presentation">
                                    End of term presentation only
                                </SelectItem>
                                <SelectItem value="other">Other</SelectItem>
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
                                options={skillOptions.map((s) => ({
                                    label: s,
                                    value: s,
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Search and select skills..."
                                allowCustom
                                customLabel="Add skill"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="proposedTeamMembers"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Team Members You Have in Mind</FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Optional: up to three names and Waterloo email addresses."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
