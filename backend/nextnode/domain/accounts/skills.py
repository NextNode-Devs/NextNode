"""Skills are typed by developers, not picked from a predefined list (decided
29 Oct 2026). Normalising them here keeps one spelling per skill: "react",
" React " and "REACT" are the same skill, stored under one key."""

import re
from dataclasses import dataclass

from nextnode.domain.errors import ValidationError

SKILL_MAX_LENGTH = 40
MAX_SKILLS = 20
_ALLOWED = re.compile(r"^[\w .+#/-]+$")


@dataclass(frozen=True)
class SkillName:
    key: str  # case-folded; unique across all skills
    label: str  # how it is shown


def normalize_skill(raw: str, field: str = "skills") -> SkillName:
    label = " ".join(raw.split())
    if not label:
        raise ValidationError("Skills can't be empty.", {field: ["Remove the empty skill."]})
    if len(label) > SKILL_MAX_LENGTH:
        raise ValidationError(
            "A skill is too long.", {field: [f'"{label[:20]}…" is over {SKILL_MAX_LENGTH} characters.']}
        )
    if not _ALLOWED.match(label) or "_" in label:
        raise ValidationError(
            "A skill has characters we don't accept.",
            {field: [f'"{label}" can use letters, numbers, spaces and + # . - / only.']},
        )
    return SkillName(key=label.casefold(), label=label)


def normalize_skills(raw: list[str], field: str = "skills") -> list[SkillName]:
    skills = [normalize_skill(item, field) for item in raw]
    if not skills:
        raise ValidationError("Add at least one skill.", {field: ["Add at least one skill."]})
    if len(skills) > MAX_SKILLS:
        raise ValidationError("Too many skills.", {field: [f"Add at most {MAX_SKILLS} skills."]})
    seen: set[str] = set()
    for skill in skills:
        if skill.key in seen:
            raise ValidationError("A skill is listed twice.", {field: [f'"{skill.label}" is listed twice.']})
        seen.add(skill.key)
    return skills
