import { Page } from "@wron/kit";
import TermsRows from "../components/terms/TermsRows";
import TermsFooter from "../components/terms/TermsFooter";

export default function Terms() {
  return (
    <Page
      title="Terms"
      description="The rules for using Open Template Library: creating, copying and sharing document templates, demand letter notes and reporting."
    >
      <div className="page-x max-w-[1600px] mx-auto pt-14 md:pt-24 pb-12 md:pb-16">
        <h1 className="t-page text-ink">Terms</h1>
      </div>
      <div className="border-t border-line">
        <TermsRows />
      </div>
      <TermsFooter />
    </Page>
  );
}
