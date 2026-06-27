import { Control } from "react-hook-form";

export interface ProjectFormValues {
    submissionTrack: "home_course" | "interdisciplinary";
    interdisciplinaryCourseId: string;
    submissionTrackLocked: boolean;
    projectTitle: string;
    projectStartDate: string;
    howHeardAboutCapstone: string;
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
    deliverableTypes: string[];
    deliverables: string;
    successCriteria: string;
    validationPlan: string;
    stakeholders: string;
    risksConstraints: string;
    publicEvaluationAcknowledged: boolean;
    ipAcknowledged: boolean;
    confidentialityAcknowledged: boolean;
    meetingFrequency: string;
    skillsRequired: string[];
    proposedTeamMembers: string;
    uwResources: string;
    orgResources: string;
    otherResources: string;
    projectDisciplines: string[];
    partnerOpportunityId: string;
    externalPartnerName: string;
    externalPartnerOrganization: string;
    externalPartnerEmail: string;
    externalPartnerWebsite: string;
    externalPartnerNotes: string;
    externalPartnerConfirmed: boolean;
}

export interface FormSectionProps {
    control: Control<ProjectFormValues>;
}
