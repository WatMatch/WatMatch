export type WatmatchRole =
    | "admin"
    | "academic_advisor"
    | "enrollment_operator"
    | "instructor"
    | "student"
    | "mentor"
    | "external_partner"
    | string;

export interface RoleCapabilities {
    canManageMarketplaceSettings: boolean;
    canRouteCommitments: boolean;
    canManageEnrollmentQueues: boolean;
    canManageCourses: boolean;
    canViewOperationsWorkbench: boolean;
    canViewCourseHealth: boolean;
    canCreateFinalizationExceptionProposal: boolean;
}
export function getRoleCapabilities(role?: string | null): RoleCapabilities {
    const normalized = (role || "").toLowerCase() as WatmatchRole;
    const isAdmin = normalized === "admin";
    const isAdvisor = normalized === "academic_advisor";
    const isEnrollmentOperator = normalized === "enrollment_operator";
    const canRoute = isAdmin || isAdvisor || isEnrollmentOperator;

    return {
        canManageMarketplaceSettings: isAdmin || isEnrollmentOperator,
        canRouteCommitments: canRoute,
        canManageEnrollmentQueues: canRoute,
        canManageCourses: isAdmin,
        canViewOperationsWorkbench: canRoute,
        canViewCourseHealth: canRoute,
        canCreateFinalizationExceptionProposal: isAdmin,
    };
}
