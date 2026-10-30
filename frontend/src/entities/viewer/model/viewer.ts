/** Mirrors `GET /api/me/` (#1). Later issues read the role from here. */
export type Role = "developer" | "client";

export type Skill = { key: string; label: string };

export type ClientProfile = { company_name: string; industry: string };

export type DeveloperProfile = {
  headline: string;
  bio: string;
  github_username: string | null;
  skills: Skill[];
};

export type Account =
  | { id: number; role: "client"; display_name: string; created_at: string | null; profile: ClientProfile }
  | {
      id: number;
      role: "developer";
      display_name: string;
      created_at: string | null;
      profile: DeveloperProfile;
    };

export type Viewer = { clerk_user_id: string; account: Account | null };

export const ROLE_LABEL: Record<Role, string> = { developer: "Developer", client: "Client" };
