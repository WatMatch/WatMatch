import { Control } from "react-hook-form";

export interface ProjectFormValues {
    projectTitle: string;
    projectStartDate: "Spring 2025" | "Fall 2025" | "";
    organizationName: string;
    primaryContact: string;
    email: string;
    phone: string;
    website: string;
    organizationDescription: string;
    organizationSize: string;
    sector: string;
    problemArea: string;
    mainObjectives: string;
    scopeOfWork: string;
    deliverables: string;
    meetingFrequency: string;
    skillsRequired: string[];
    uwResources: string;
    orgResources: string;
    otherResources: string;
    projectDisciplines: string[];
}

export interface FormSectionProps {
    control: Control<ProjectFormValues>;
}
