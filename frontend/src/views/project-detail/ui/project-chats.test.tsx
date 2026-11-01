import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeadChat } from "@/entities/lead-candidacy";
import type { ApiResult, BrowserApi } from "@/shared/api/browser-client";

import { firstChat, ProjectChats } from "./project-chats";

const nav = vi.hoisted(() => ({ refresh: vi.fn(), chat: null as string | null }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: nav.refresh }),
  useSearchParams: () => new URLSearchParams(nav.chat ? { chat: nav.chat } : {}),
}));
vi.mock("@/shared/api/browser-client", () => ({ useApiClient: () => null }));
vi.mock("@/shared/api/realtime", () => ({ useRealtime: () => ({ connection: null }) }));
vi.mock("@/widgets/conversation-chat", () => ({
  ConversationChat: ({ conversationId }: { conversationId: string }) => <p>chat {conversationId}</p>,
}));

const chat = (id: string, name: string, overrides: Partial<LeadChat> = {}): LeadChat => ({
  candidacy_id: id,
  developer_account_id: 2,
  developer_name: name,
  kind: "application",
  status: "candidate",
  conversation_id: `c-${id}`,
  ...overrides,
});

const fakeApi = (result: ApiResult<LeadChat[]>) => ({ get: vi.fn(async () => result) }) as unknown as BrowserApi;

beforeEach(() => {
  nav.chat = null;
});

describe("firstChat", () => {
  it("opens the hired Lead, else the first still in play, else the oldest", () => {
    const declined = chat("a", "Ada", { status: "declined" });
    const open = chat("b", "Linus");
    expect(firstChat([declined, open])?.candidacy_id).toBe("b");
    expect(firstChat([open, chat("c", "Grace", { status: "hired" })])?.candidacy_id).toBe("c");
    expect(firstChat([declined])?.candidacy_id).toBe("a");
  });
});

describe("ProjectChats", () => {
  it("lets the client switch between candidates' conversations", async () => {
    const api = fakeApi({ ok: true, data: [chat("a", "Ada"), chat("b", "Linus", { kind: "invitation", status: "invited" })] });
    render(<ProjectChats projectId={4} myAccountId={1} isOwner api={api} />);
    expect(await screen.findByRole("heading", { name: "Team Lead conversations" })).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith("/api/projects/4/lead-chats/");
    expect(screen.getByText("chat c-a")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ada/ })).toHaveAttribute("aria-pressed", "true");
    await userEvent.setup().click(screen.getByRole("button", { name: /Linus.*You invited.*Invited/ }));
    expect(screen.getByText("chat c-b")).toBeInTheDocument();
  });

  it("opens the conversation named in ?chat= first", async () => {
    nav.chat = "b";
    const api = fakeApi({ ok: true, data: [chat("a", "Ada"), chat("b", "Linus")] });
    render(<ProjectChats projectId={4} myAccountId={1} isOwner api={api} />);
    expect(await screen.findByText("chat c-b")).toBeInTheDocument();
  });

  it("shows the client an empty state with a way to find developers", async () => {
    render(<ProjectChats projectId={4} myAccountId={1} isOwner api={fakeApi({ ok: true, data: [] })} />);
    expect(await screen.findByText(/No applications yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find developers" })).toHaveAttribute("href", "/developers");
  });

  it("shows a developer only their conversation, and nothing before they apply", async () => {
    const api = fakeApi({ ok: true, data: [chat("a", "Ada")] });
    render(<ProjectChats projectId={4} myAccountId={2} isOwner={false} api={api} />);
    expect(await screen.findByRole("heading", { name: "Your conversation with the client" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Candidates" })).not.toBeInTheDocument();
    expect(screen.getByText("chat c-a")).toBeInTheDocument();

    const none = fakeApi({ ok: true, data: [] });
    const { container } = render(<ProjectChats projectId={5} myAccountId={2} isOwner={false} api={none} />);
    await waitFor(() => expect(none.get).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("says when the conversations can't be loaded", async () => {
    const api = fakeApi({ ok: false, error: { code: "UNREACHABLE", message: "We couldn't reach NextNode." } });
    render(<ProjectChats projectId={4} myAccountId={1} isOwner api={api} />);
    expect(await screen.findByText(/couldn.t load this project.s conversations/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
