import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionProps } from "./types";

export function ResourcesSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Required Resources</h2>

            <FormField
                control={control}
                name="uwResources"
                rules={{ required: "UWaterloo resources are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            UWaterloo Resources Needed{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="e.g., software, tools, 3D printing, etc."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="orgResources"
                rules={{ required: "Organization resources are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Organization Resources Needed{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="e.g., datasets, test facilities"
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="otherResources"
                rules={{ required: "Other resources are required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Other Resources Needed{" "}
                            <span className="text-red-500">*</span>
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
