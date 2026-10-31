"use client";

import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

import { PORTFOLIO_LIMITS, portfolioHref, type Portfolio } from "@/entities/developer";
import { SkillsInput } from "@/entities/skill";
import { FormField } from "@/shared/ui/molecules/form-field";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/shadcn/alert";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";
import { Textarea } from "@/shared/ui/shadcn/textarea";

import { savePortfolio, type SaveFailure } from "../api/save-portfolio";
import { draftFrom, type FieldErrors, type PortfolioDraft, type ProjectDraft } from "../model/draft";
import { validateDraft } from "../model/validate";
import { ProjectFields } from "./project-fields";

type Props = {
  portfolio: Portfolio;
  /** Injected in tests; the real action saves through the API and opens the portfolio. */
  save?: (draft: PortfolioDraft) => Promise<SaveFailure>;
};

const CHECK_FIELDS = "Some details need attention. Check the highlighted fields.";

/** The owner's portfolio form. Errors show on each field, with a summary at the top. */
export function EditPortfolioForm({ portfolio, save = savePortfolio }: Props) {
  const [draft, setDraft] = useState(() => draftFrom(portfolio));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nextKey = useRef(0);
  const summary = useRef<HTMLDivElement>(null);

  const clear = (...fields: string[]) =>
    setErrors((current) => {
      if (!fields.some((field) => field in current)) return current;
      const next = { ...current };
      for (const field of fields) delete next[field];
      return next;
    });
  const update = <K extends keyof PortfolioDraft>(field: K, value: PortfolioDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    clear(field);
  };
  const updateProject = (index: number, field: keyof Omit<ProjectDraft, "key">, value: string) => {
    setDraft((current) => ({
      ...current,
      projects: current.projects.map((p, i) => (i === index ? { ...p, [field]: value } : p)),
    }));
    clear(`projects.${index}.${field}`);
  };
  // Removing or adding a row renumbers the rows after it, so their old errors no longer line up.
  const clearProjectErrors = () =>
    setErrors((current) => Object.fromEntries(Object.entries(current).filter(([k]) => !k.startsWith("projects"))));

  const fail = (message: string, fields: FieldErrors) => {
    setFailure(message);
    setErrors(fields);
    requestAnimationFrame(() => summary.current?.focus());
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const problems = validateDraft(draft);
    if (Object.keys(problems).length) return fail(CHECK_FIELDS, problems);
    setFailure(null);
    startTransition(async () => {
      const result = await save(draft); // on success it navigates to the saved portfolio
      if (result) fail(result.message, result.fields);
    });
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-busy={pending} className="space-y-8">
      {failure ? (
        <Alert ref={summary} tabIndex={-1} variant="destructive" role="alert" className="outline-none">
          <AlertTitle>Your portfolio wasn&apos;t saved</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      ) : null}

      <Section title="About you">
        <FormField
          id="headline"
          label="Headline"
          required
          hint="One line about what you do, e.g. “Full-stack developer, React and Django”."
          error={errors.headline}
        >
          {(aria) => (
            <Input
              {...aria}
              required
              maxLength={PORTFOLIO_LIMITS.headline}
              value={draft.headline}
              onChange={(e) => update("headline", e.target.value)}
            />
          )}
        </FormField>
        <FormField id="bio" label="Bio" hint={`Up to ${PORTFOLIO_LIMITS.bio} characters.`} error={errors.bio}>
          {(aria) => (
            <Textarea
              {...aria}
              rows={5}
              maxLength={PORTFOLIO_LIMITS.bio}
              value={draft.bio}
              onChange={(e) => update("bio", e.target.value)}
            />
          )}
        </FormField>
        <FormField id="skills" label="Skills" required hint="Type a skill and press Enter." error={errors.skills}>
          {(aria) => <SkillsInput {...aria} value={draft.skills} onChange={(skills) => update("skills", skills)} />}
        </FormField>
      </Section>

      <Section title="Projects" description="Link the work you're proud of. Clients see these first.">
        <ProjectFields
          projects={draft.projects}
          errors={errors}
          onChange={updateProject}
          onAdd={() => {
            update("projects", [
              ...draft.projects,
              { key: `new-${nextKey.current++}`, title: "", repository_url: "", demo_url: "" },
            ]);
            clearProjectErrors();
          }}
          onRemove={(index) => {
            update(
              "projects",
              draft.projects.filter((_, i) => i !== index),
            );
            clearProjectErrors();
          }}
        />
      </Section>

      <Section title="Links" description="Shown on your portfolio exactly as you enter them. NextNode doesn't check them.">
        <FormField id="github_username" label="GitHub username" error={errors.github_username}>
          {(aria) => (
            <Input
              {...aria}
              maxLength={40}
              autoCapitalize="none"
              spellCheck={false}
              value={draft.github_username}
              onChange={(e) => update("github_username", e.target.value)}
            />
          )}
        </FormField>
        <FormField id="resume_url" label="Resume link" hint="A link to your CV, e.g. a PDF you host." error={errors.resume_url}>
          {(aria) => (
            <Input
              {...aria}
              type="url"
              inputMode="url"
              placeholder="https://example.com/your-cv.pdf"
              maxLength={PORTFOLIO_LIMITS.url}
              value={draft.resume_url}
              onChange={(e) => update("resume_url", e.target.value)}
            />
          )}
        </FormField>
      </Section>

      <Section title="Availability">
        <div className="flex items-start gap-3">
          <input
            id="is_available"
            type="checkbox"
            checked={draft.is_available}
            onChange={(e) => update("is_available", e.target.checked)}
            aria-describedby="is_available-hint"
            className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          />
          <div className="space-y-1">
            <label htmlFor="is_available" className="text-sm font-medium">
              Available for work
            </label>
            <p id="is_available-hint" className="text-xs text-muted-foreground">
              Shows a badge on your portfolio, and clients filtering for available developers will find you.
            </p>
          </div>
        </div>
      </Section>

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        <Button asChild variant="outline" size="lg">
          <Link href={portfolioHref(portfolio.account_id)}>Cancel</Link>
        </Button>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin motion-reduce:animate-none" aria-hidden /> : null}
          {pending ? "Saving…" : "Save portfolio"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  const id = `section-${title.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <section className="space-y-5" aria-labelledby={id}>
      <div className="space-y-1">
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}
