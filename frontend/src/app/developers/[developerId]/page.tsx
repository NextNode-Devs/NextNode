import { PortfolioView } from "@/views/portfolio";

export const metadata = { title: "Portfolio" };

export default function Page({ params, searchParams }: PageProps<"/developers/[developerId]">) {
  // Resolved inside the view's Suspense boundary, so the page shell renders at once.
  return (
    <PortfolioView
      developerId={params.then((p) => p.developerId)}
      saved={searchParams.then((s) => s.saved === "1")}
    />
  );
}
