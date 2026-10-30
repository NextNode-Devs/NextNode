"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import type { Role } from "@/entities/viewer";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";
import { Separator } from "@/shared/ui/shadcn/separator";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import { completeOnboarding } from "../api/complete-onboarding";
import type { OnboardingState } from "../model/onboarding-state";
import { LIMITS } from "../model/schema";
import { FormField } from "./form-field";
import { RoleChoice } from "./role-choice";
import { SkillsInput } from "./skills-input";

type Props = {
  /** Prefilled from the Clerk profile; editable. */
  defaultDisplayName?: string;
  /** Injected in tests; the real action calls the backend and redirects. */
  action?: (previous: OnboardingState, form: FormData) => Promise<OnboardingState>;
};

/**
 * Choose Developer or Client once, then fill in the matching profile. Errors
 * appear on each field and in a summary at the top.
 */
export function OnboardingForm({ defaultDisplayName = "", action = completeOnboarding }: Props) {
  const [state, submit, pending] = useActionState(action, null);
  const [role, setRole] = useState<Role | null>((state?.values.role as Role) || null);
  const [skills, setSkills] = useState<string[]>([]);
  const errors = state?.fields ?? {};
  const value = (name: string, fallback = "") => state?.values[name] ?? fallback;

  return (
    <form action={submit} className="space-y-8" noValidate aria-busy={pending}>
      {state ? (
        <Alert variant="destructive" role="alert">
          <AlertTitle>We couldn&apos;t finish setting up your account</AlertTitle>
          <AlertDescription>
            <p>{state.message}</p>
            {state.code === "ALREADY_ONBOARDED" ? (
              <Link href="/dashboard" className="font-medium underline underline-offset-4">
                Go to your dashboard
              </Link>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <RoleChoice value={role} onChange={setRole} error={errors.role} />

      {role ? (
        <>
          <Separator />
          <div className="space-y-5">
            <h2 className="text-lg font-semibold">
              {role === "developer" ? "Your developer profile" : "Your client profile"}
            </h2>
            <FormField id="display_name" label="Display name" required error={errors.display_name}>
              {(aria) => (
                <Input
                  {...aria}
                  name="display_name"
                  required
                  maxLength={LIMITS.displayName}
                  autoComplete="name"
                  defaultValue={value("display_name", defaultDisplayName)}
                />
              )}
            </FormField>
            {role === "client" ? <ClientFields value={value} errors={errors} /> : null}
            {role === "developer" ? (
              <DeveloperFields value={value} errors={errors} skills={skills} onSkills={setSkills} />
            ) : null}
          </div>
        </>
      ) : null}

      <Button type="submit" size="lg" disabled={pending || !role} className="w-full sm:w-auto">
        {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
        {pending ? "Creating your account…" : "Create my account"}
      </Button>
    </form>
  );
}

type FieldsProps = {
  value: (name: string, fallback?: string) => string;
  errors: NonNullable<OnboardingState>["fields"];
};

function ClientFields({ value, errors }: FieldsProps) {
  return (
    <>
      <FormField id="company_name" label="Company name" required error={errors.company_name}>
        {(aria) => (
          <Input
            {...aria}
            name="company_name"
            required
            maxLength={LIMITS.companyName}
            autoComplete="organization"
            defaultValue={value("company_name")}
          />
        )}
      </FormField>
      <FormField
        id="industry"
        label="Industry"
        required
        hint="For example: Retail, Healthcare, Education."
        error={errors.industry}
      >
        {(aria) => (
          <Input {...aria} name="industry" required maxLength={LIMITS.industry} defaultValue={value("industry")} />
        )}
      </FormField>
    </>
  );
}

function DeveloperFields({
  value,
  errors,
  skills,
  onSkills,
}: FieldsProps & { skills: string[]; onSkills: (skills: string[]) => void }) {
  return (
    <>
      <FormField
        id="headline"
        label="Headline"
        required
        hint="One line about what you do, e.g. “Full-stack developer, React and Django”."
        error={errors.headline}
      >
        {(aria) => (
          <Input {...aria} name="headline" required maxLength={LIMITS.headline} defaultValue={value("headline")} />
        )}
      </FormField>
      <FormField id="bio" label="Bio" hint={`Up to ${LIMITS.bio} characters.`} error={errors.bio}>
        {(aria) => <Textarea {...aria} name="bio" rows={4} maxLength={LIMITS.bio} defaultValue={value("bio")} />}
      </FormField>
      <FormField
        id="github_username"
        label="GitHub username"
        hint="Shown on your portfolio as provided; it isn't verified."
        error={errors.github_username}
      >
        {(aria) => (
          <Input
            {...aria}
            name="github_username"
            maxLength={40}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            defaultValue={value("github_username")}
          />
        )}
      </FormField>
      <FormField
        id="skills"
        label="Skills"
        required
        hint="Type a skill and press Enter. Add at least one."
        error={errors.skills}
      >
        {(aria) => <SkillsInput {...aria} value={skills} onChange={onSkills} />}
      </FormField>
    </>
  );
}
