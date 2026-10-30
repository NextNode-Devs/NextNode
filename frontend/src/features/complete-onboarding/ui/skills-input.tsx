"use client";

import { XIcon } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";

import {
  cleanSkill,
  MAX_SKILLS,
  SKILL_MAX_LENGTH,
  SKILL_PATTERN,
  skillKey,
  useSkillSuggestions,
} from "@/entities/skill";
import { Badge } from "@/shared/ui/shadcn/badge";
import { Button } from "@/shared/ui/shadcn/button";
import { Input } from "@/shared/ui/shadcn/input";

type Props = {
  id: string;
  value: string[];
  onChange: (skills: string[]) => void;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/**
 * Developers type their own skills (decided 29 Oct 2026). Enter or comma adds
 * one; suggestions from skills already on NextNode keep spellings consistent.
 * Each skill is also submitted as a hidden `skills` field.
 */
export function SkillsInput({ id, value, onChange, ...aria }: Props) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const suggestions = useSkillSuggestions(draft).filter((s) => !value.some((v) => skillKey(v) === s.key));
  const listId = useId();

  function add(raw: string) {
    const label = cleanSkill(raw);
    if (!label) return;
    if (value.length >= MAX_SKILLS) return setProblem(`You can add at most ${MAX_SKILLS} skills.`);
    if (label.length > SKILL_MAX_LENGTH) return setProblem(`Keep each skill under ${SKILL_MAX_LENGTH} characters.`);
    if (!SKILL_PATTERN.test(label)) return setProblem("Skills can use letters, numbers, spaces and + # . - / only.");
    if (value.some((existing) => skillKey(existing) === skillKey(label))) {
      return setProblem(`"${label}" is already added.`);
    }
    onChange([...value, label]);
    setDraft("");
    setProblem(null);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      add(draft);
    } else if (event.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Added skills">
          {value.map((skill) => (
            <li key={skillKey(skill)}>
              <input type="hidden" name="skills" value={skill} />
              <Badge variant="secondary" className="gap-1 py-1 pr-1 pl-2.5 text-sm">
                {skill}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((v) => v !== skill))}
                  className="rounded-full p-0.5 hover:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`Remove ${skill}`}
                >
                  <XIcon className="size-3.5" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Input
          id={id}
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value.replace(",", ""));
            setProblem(null);
          }}
          onKeyDown={onKeyDown}
          list={listId}
          autoComplete="off"
          placeholder={value.length ? "Add another skill" : "e.g. React, Django, PostgreSQL"}
          maxLength={SKILL_MAX_LENGTH}
          aria-invalid={aria["aria-invalid"] || Boolean(problem)}
          aria-describedby={[aria["aria-describedby"], problem ? `${id}-problem` : null].filter(Boolean).join(" ") || undefined}
        />
        <Button type="button" variant="outline" onClick={() => add(draft)} disabled={!draft.trim()}>
          Add
        </Button>
      </div>
      <datalist id={listId}>
        {suggestions.map((s) => (
          <option key={s.key} value={s.label} />
        ))}
      </datalist>
      {problem ? (
        <p id={`${id}-problem`} role="status" className="text-sm text-destructive">
          {problem}
        </p>
      ) : null}
    </div>
  );
}
