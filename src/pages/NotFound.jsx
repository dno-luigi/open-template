import { Page } from "@wron/kit";
import Button from "../components/Button";
import SectionLink from "../components/SectionLink";

export default function NotFound() {
  return (
    <Page title="Page not found" description="This page does not exist. Go back to Forms to make, save and share document templates." noindex>
      <section className="page-x max-w-[1600px] mx-auto py-24 md:py-32">
        <h1 className="t-page text-ink">Page not found</h1>
        <p className="mt-4 text-[17px] text-muted max-w-[40ch]">This page does not exist. Your saved templates are still on this device.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button to="/" size="lg">Go to the editor</Button>
          <SectionLink id="community" className="inline-flex items-center h-12 px-5 rounded-[6px] border border-primary/60 text-primary t-btn hover:bg-surface transition-colors duration-150">
            Browse community templates
          </SectionLink>
        </div>
      </section>
    </Page>
  );
}
