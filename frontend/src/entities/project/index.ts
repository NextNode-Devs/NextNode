export {
  getDocumentLink,
  getMyProjects,
  getProject,
  listDocuments,
  searchProjects,
  type ApiGetter,
} from "./api/project-api";
export {
  hasProjectFilters,
  NO_PROJECT_FILTERS,
  normalizeTech,
  parseProjectParams,
  projectQuery,
  type ProjectFilters,
} from "./lib/project-params";
export {
  draftFrom,
  EMPTY_DRAFT,
  fieldErrorsFromApi,
  parseBudget,
  saveFailureFrom,
  toRequestBody,
  validateDraft,
  type FieldErrors,
  type ProjectDraft,
} from "./model/draft";
export {
  KIND_LABEL,
  PROJECT_LIMITS,
  projectHref,
  STATUS_LABEL,
  type MyProject,
  type Person,
  type Project,
  type ProjectCard as ProjectCardData,
  type ProjectKind,
  type ProjectPage,
  type ProjectStatus,
  type RequirementDocument,
  type ViewerAction,
} from "./model/project";
// Phase 2 prototype (NN-32 #88): dashboard v2 roles and needs attention.
export {
  PROJECT_ROLE_LABEL,
  PROJECT_ROLES,
  type AttentionItem,
  type AttentionKind,
  type DashboardProject,
  type ProjectRole,
} from "./model/dashboard";
// Prototype sample data: import only from Phase 2 prototype screens.
export { sampleDashboard, type SampleDashboard } from "./model/sample";
export { ProjectRoleBadge } from "./ui/project-role-badge";
// Phase 2 prototype (#93): the "To be defined" legal terms.
export { LegalTerms, LegalTermsCard } from "./ui/legal-terms";
export { KindBadge, ProposedBudget, StatusBadge, TechStack } from "./ui/project-bits";
export { ProjectCard } from "./ui/project-card";
export { ProjectForm, type SaveFailure, type TechStackInputProps } from "./ui/project-form";
