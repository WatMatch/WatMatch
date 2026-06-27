import {
    FormField,
    FormItem,
    FormLabel,
    FormControl,
    FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { FormSectionProps, ProjectFormValues } from "./types";
import { useFormContext } from "react-hook-form";

function hasExternalPartnerDetails(values: Partial<ProjectFormValues>) {
    return [
        values.partnerOpportunityId,
        values.externalPartnerName,
        values.externalPartnerOrganization,
        values.externalPartnerEmail,
        values.externalPartnerWebsite,
        values.externalPartnerNotes,
    ].some((value) => String(value || "").trim().length > 0);
}

export function ResourcesSection({ control }: FormSectionProps) {
    const form = useFormContext<ProjectFormValues>();
    const linkedOpportunityId = form.watch("partnerOpportunityId");
    const hasLinkedOpportunity =
        String(linkedOpportunityId || "").trim().length > 0;

    const unlinkExternalOpportunity = () => {
        form.setValue("partnerOpportunityId", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerConfirmed", false, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

    const clearExternalPartnerDetails = () => {
        form.setValue("partnerOpportunityId", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerName", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerOrganization", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerEmail", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerWebsite", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerNotes", "", {
            shouldDirty: true,
            shouldValidate: true,
        });
        form.setValue("externalPartnerConfirmed", false, {
            shouldDirty: true,
            shouldValidate: true,
        });
    };

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

            <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
                External partners are optional. Only link or list a partner after
                your team has contacted them and they have agreed to support the
                capstone.
            </div>

            <h2 className="text-lg font-semibold">External Partner</h2>

            {hasLinkedOpportunity && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <p className="font-medium text-slate-900">
                                External opportunity linked
                            </p>
                            <p className="text-slate-600">
                                This proposal is connected to an external partner
                                opportunity. Unlink it if your team is no longer
                                using that opportunity.
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={unlinkExternalOpportunity}
                        >
                            Unlink
                        </Button>
                    </div>
                </div>
            )}

            <FormField
                control={control}
                name="externalPartnerName"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Partner Contact Name</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Name of the external contact" />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="externalPartnerOrganization"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Partner Organization</FormLabel>
                        <FormControl>
                            <Input {...field} placeholder="Hospital, lab, company, nonprofit, etc." />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                    control={control}
                    name="externalPartnerEmail"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Partner Email</FormLabel>
                            <FormControl>
                                <Input {...field} type="email" />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={control}
                    name="externalPartnerWebsite"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Partner Link</FormLabel>
                            <FormControl>
                                <Input {...field} placeholder="https://..." />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />
            </div>

            <FormField
                control={control}
                name="externalPartnerNotes"
                render={({ field }) => (
                    <FormItem>
                        <FormLabel>Partner Notes</FormLabel>
                        <FormControl>
                            <Textarea
                                {...field}
                                placeholder="Briefly describe the partner's involvement and what has already been agreed."
                            />
                        </FormControl>
                        <FormMessage />
                    </FormItem>
                )}
            />

            <FormField
                control={control}
                name="externalPartnerConfirmed"
                rules={{
                    validate: (value, values) =>
                        !hasExternalPartnerDetails(values) ||
                        value === true ||
                        "Confirm that this partner has agreed before submitting.",
                }}
                render={({ field }) => (
                    <FormItem className="rounded-md border border-slate-200 bg-white p-3">
                        <div className="flex items-start gap-3">
                            <FormControl>
                                <Checkbox
                                    checked={field.value}
                                    onCheckedChange={(checked) =>
                                        field.onChange(checked === true)
                                    }
                                />
                            </FormControl>
                            <div className="space-y-1">
                                <FormLabel className="text-sm font-medium">
                                    The external partner has agreed to support this
                                    capstone.
                                </FormLabel>
                                <p className="text-xs text-slate-500">
                                    Required when your proposal lists or links an
                                    external partner.
                                </p>
                                <FormMessage />
                            </div>
                        </div>
                    </FormItem>
                )}
            />

            <div className="flex justify-end">
                <Button
                    type="button"
                    variant="outline"
                    onClick={clearExternalPartnerDetails}
                >
                    Clear Partner Details
                </Button>
            </div>
        </div>
    );
}
