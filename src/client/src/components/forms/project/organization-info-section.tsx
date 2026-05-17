import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSectionProps } from "./types";

export function OrganizationInfoSection({ control }: FormSectionProps) {
    return (
        <div className="space-y-4">
            <h2 className="text-lg font-semibold">Organization Information</h2>

            <FormField
                control={control}
                name="organizationName"
                rules={{ required: "Organization name is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Organization Name{" "}
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
                name="primaryContact"
                rules={{ required: "Primary contact is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Primary Contact{" "}
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
                name="email"
                rules={{
                    required: "Email address is required",
                    pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: "Invalid email address",
                    },
                }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Email Address{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="phone"
                rules={{ required: "Phone number is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Phone Number <span className="text-red-500">*</span>
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
                name="website"
                rules={{ required: "Website is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Website <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input type="url" {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="organizationDescription"
                rules={{ required: "Organization description is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Brief Description{" "}
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
                name="organizationSize"
                rules={{ required: "Organization size is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Size of Organization{" "}
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
                name="sector"
                rules={{ required: "Sector/Industry is required" }}
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>
                            Sector / Industry{" "}
                            <span className="text-red-500">*</span>
                        </FormLabel>
                        <FormControl>
                            <Input {...field} />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />
        </div>
    );
}
