import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FormSectionProps } from "./types";
import { disciplines } from "./config";
import { MultiSelect } from "@/components/ui/multiselect";

export function PreliminaryInfoSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Preliminary Information</h2>
            <FormField
                control={control}
                name="projectTitle"
                rules={{ required: "Project title is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Project Title{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="projectDisciplines"
                rules={{
                    required: "At least one discipline is required",
                    validate: (value) =>
                        (value && value.length > 0) ||
                        "At least one discipline is required",
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Project Disciplines{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <MultiSelect
                                options={disciplines.map((d) => ({
                                    label: d,
                                    value: d,
                                }))}
                                value={field.value || []}
                                onChange={field.onChange}
                                placeholder="Search and select disciplines..."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="projectStartDate"
                rules={{ required: "Project start date is required" }}
                render={({ field: { value, onChange, ...field } }) => (
                    <FormItem>
                        <FormLabel>
                            Project Start Date{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <RadioGroup
                                value={value}
                                onValueChange={onChange}
                                {...field}
                                className="text-sm"
                            >
                                <FormItem>
                                    <RadioGroupItem value="Spring 2025">
                                        Spring 2025
                                    </RadioGroupItem>
                                </FormItem>
                                <FormItem>
                                    <RadioGroupItem value="Fall 2025">
                                        Fall 2025
                                    </RadioGroupItem>
                                </FormItem>
                            </RadioGroup>
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
