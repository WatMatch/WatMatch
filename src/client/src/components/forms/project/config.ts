import { Control } from "react-hook-form";
import { ProjectFormValues } from "./types";
import {
    PreliminaryInfoSection,
    OrganizationInfoSection,
    ProjectInfoSection,
    ProjectTeamSection,
    ResourcesSection,
} from "./";

export interface FormStep {
    id: number;
    name: string;
    isActive: boolean;
    isCompleted: boolean;
}

export interface FormSection {
    step: number;
    component: React.ComponentType<{ control: Control<ProjectFormValues> }>;
}

export const defaultFormValues: ProjectFormValues = {
    projectStartDate: "",
    projectTitle: "",
    organizationName: "",
    primaryContact: "",
    email: "",
    phone: "",
    website: "",
    organizationDescription: "",
    organizationSize: "",
    sector: "",
    problemArea: "",
    mainObjectives: "",
    scopeOfWork: "",
    deliverables: "",
    meetingFrequency: "",
    skillsRequired: [],
    uwResources: "",
    orgResources: "",
    otherResources: "",
    projectDisciplines: [],
};

// --- Form Steps and Section Mappings ---
export const defaultFormSteps: FormStep[] = [
    { id: 1, name: "User Name", isActive: true, isCompleted: false },
    { id: 2, name: "Location", isActive: false, isCompleted: false },
    { id: 3, name: "Business", isActive: false, isCompleted: false },
    { id: 4, name: "Bank", isActive: false, isCompleted: false },
    { id: 5, name: "Verification", isActive: false, isCompleted: false },
];

export const organizationFormSteps: FormStep[] = [
    { id: 1, name: "User Name", isActive: true, isCompleted: false },
    { id: 2, name: "Location", isActive: false, isCompleted: false },
    { id: 3, name: "Business", isActive: false, isCompleted: false },
    { id: 4, name: "Bank", isActive: false, isCompleted: false },
    { id: 5, name: "Verification", isActive: false, isCompleted: false },
];

export const studentFormSteps: FormStep[] = [
    { id: 1, name: "Basics", isActive: true, isCompleted: false },
    { id: 2, name: "Project", isActive: false, isCompleted: false },
    { id: 3, name: "Team", isActive: false, isCompleted: false },
    { id: 4, name: "Resources", isActive: false, isCompleted: false },
];

export const organizationFormSections: Record<
    number,
    React.ComponentType<{ control: Control<ProjectFormValues> }>
> = {
    1: PreliminaryInfoSection,
    2: OrganizationInfoSection,
    3: ProjectInfoSection,
    4: ProjectTeamSection,
    5: ResourcesSection,
};

export const studentFormSections: Record<
    number,
    React.ComponentType<{ control: Control<ProjectFormValues> }>
> = {
    1: PreliminaryInfoSection,
    2: ProjectInfoSection,
    3: ProjectTeamSection,
    4: ResourcesSection,
};

// --- Disciplines ---
export const disciplines = [
    "Computer Science",
    "Engineering",
    "Mathematics",
    "Physics",
    "Chemistry",
    "Biology",
    "Biochemistry",
    "Earth Sciences",
    "Environmental Sciences",
    "Data Science",
    "Actuarial Science",
    "Economics",
    "Business Administration",
    "Accounting and Financial Management",
    "Social Work",
    "Psychology",
    "Philosophy",
    "Political Science",
    "History",
    "English",
    "Fine Arts",
    "Music",
    "Theatre",
    "Communication Studies",
    "Gender and Social Justice",
    "Peace and Conflict Studies",
    "Education",
    "Planning",
    "Health Sciences",
    "Optometry",
    "Pharmacy",
    "Nanotechnology",
    "Quantum Engineering",
    "Management Engineering",
    "Environmental Engineering",
];

export const skills = [
    "Research",
    "Machining",
    "Ethics Training",
    "Data Analysis",
    "Programming",
    "Design",
    "Project Management",
    "Communication",
    "Leadership",
    "Presentation",
    "Writing",
    "Teamwork",
    "Problem Solving",
    "Critical Thinking",
    "Time Management",
    "Budgeting",
    "Testing",
    "Documentation",
    "Prototyping",
    "Field Work",
    "Surveying",
    "Statistical Analysis",
    "CAD",
    "Simulation",
    "Networking",
    "Mentoring",
    "3D CAD",
    "FEA analysis",
    "Circuit design",
    "Hydraulics",
    "Pneumatics",
    "Control systems",
    "CNC programming",
    "PCB layout",

    // Science & Research
    "Mass spectrometry",
    "HPLC",
    "Electron microscopy",
    "PCR",
    "Cell culture",
    "Experimental design",
    "Statistical modeling",

    // IT & Computer Science
    "Python",
    "Java",
    "C++",
    "JavaScript",
    "Go",
    "Rust",
    "React.js",
    "Node.js",
    "AWS",
    "TensorFlow",
    "Pen testing",
    "SQL",
    "Kubernetes",

    // Data & Analytics
    "Tableau",
    "Power BI",
    "Predictive modeling",
    "Spark",
    "Time series",
    "A/B testing",
    "R",
    "MATLAB",

    // Design & Creative Tech
    "Illustrator",
    "Photoshop",
    "Figma",
    "Blender",
    "After Effects",
    "Unity AR/VR",

    // Energy & Environment
    "Solar design",
    "Wind modeling",
    "Impact assessment",
    "ArcGIS",
    "Water testing",
    "Energy modeling",

    // Health & Biotechnology
    "NGS analysis",
    "Bioinformatics",
    "Medical imaging",
    "ELISA",
    "Lab automation",

    // Finance & Business Tech
    "Financial forecasting",
    "SAP ERP",
    "RPA",
    "BI reporting",
    "Risk modeling",

    // Emerging Tech
    "Solidity",
    "IoT deployment",
    "Quantum algorithms",
    "Drone programming",
    "Autonomous calibration",
];
