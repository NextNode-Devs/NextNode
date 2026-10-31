import { CodeIcon, ExternalLinkIcon, FileTextIcon, FolderGit2Icon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/shadcn/card";

import type { Portfolio } from "../model/developer";
import { AvailabilityBadge, SkillList } from "./developer-bits";

type Props = {
  portfolio: Portfolio;
  /** Beside the name: the owner's edit button, or #4/#5's invite actions. */
  actions?: ReactNode;
};

/** A developer's portfolio as everyone sees it. Links open as entered; none is "verified". */
export function PortfolioProfile({ portfolio, actions }: Props) {
  const { projects } = portfolio;
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <AvailabilityBadge available={portfolio.is_available} />
          <h1 className="text-2xl font-semibold tracking-tight break-words sm:text-3xl">{portfolio.display_name}</h1>
          <p className="text-lg text-muted-foreground break-words">{portfolio.headline}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
      </header>

      <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-base font-semibold">About</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {portfolio.bio ? (
                <p className="whitespace-pre-line break-words">{portfolio.bio}</p>
              ) : (
                <p className="text-sm text-muted-foreground">No bio yet.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <h2 className="text-base font-semibold">Projects</h2>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length ? (
                <ul className="divide-y">
                  {projects.map((project, index) => (
                    <li key={index} className="space-y-2 py-3 first:pt-0 last:pb-0">
                      <h3 className="font-medium break-words">{project.title}</h3>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <OutLink href={project.repository_url} icon={<FolderGit2Icon aria-hidden />}>
                          Repository
                        </OutLink>
                        {project.demo_url ? (
                          <OutLink href={project.demo_url} icon={<ExternalLinkIcon aria-hidden />}>
                            Live demo
                          </OutLink>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No projects added yet.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Skills and links</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <SkillList skills={portfolio.skills} />
            <ul className="space-y-2 text-sm">
              {portfolio.github_url ? (
                <li>
                  <OutLink href={portfolio.github_url} icon={<CodeIcon aria-hidden />}>
                    GitHub: {portfolio.github_username}
                  </OutLink>
                </li>
              ) : null}
              {portfolio.resume_url ? (
                <li>
                  <OutLink href={portfolio.resume_url} icon={<FileTextIcon aria-hidden />}>
                    Resume
                  </OutLink>
                </li>
              ) : null}
              {!portfolio.github_url && !portfolio.resume_url ? (
                <li className="text-muted-foreground">No GitHub profile or resume added.</li>
              ) : null}
            </ul>
            <p className="text-xs text-muted-foreground">Links are shown as the developer entered them.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** An external link: new tab, no referrer or opener, says where it goes. */
function OutLink({ href, icon, children }: { href: string; icon: ReactNode; children: ReactNode }) {
  // The API accepts only http(s) links; never turn anything else into a clickable href.
  if (!/^https?:\/\//i.test(href)) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex max-w-full items-center gap-1.5 font-medium underline-offset-4 hover:underline [&_svg]:size-4 [&_svg]:shrink-0"
    >
      {icon}
      <span className="truncate">{children}</span>
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}
