import { PortfolioView } from "@/views/portfolio";

export const metadata = { title: "My portfolio" };

/** Sends a developer to their own portfolio; the view explains why a client has none. */
export default function Page() {
  return <PortfolioView developerId={Promise.resolve("me")} />;
}
