import { Page } from "@wron/kit";
import { PRIVACY_LINE } from "../data/site";
import PrivacyRows from "../components/privacy/PrivacyRows";
import PrivacyFooter from "../components/privacy/PrivacyFooter";

export default function Privacy() {
  return (
    <Page
      title="Privacy notice"
      description="What stays on your device and what is shared: saved templates, drafts and optional community sharing, explained in plain language."
    >
      <div className="page-x max-w-[1600px] mx-auto pt-14 md:pt-24 pb-16">
        <div className="page-grid">
          <header className="col-span-12 lg:col-span-6">
            <h1 className="t-page text-ink">Privacy notice</h1>
            <p className="mt-5 text-[18px] md:text-[22px] leading-[1.45] text-muted max-w-[30ch]">{PRIVACY_LINE}</p>
          </header>
        </div>
        <PrivacyRows />
        <PrivacyFooter />
      </div>
    </Page>
  );
}
