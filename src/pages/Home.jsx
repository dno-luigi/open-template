import { lazy, Suspense } from "react";
import { Page } from "@wron/kit";
import Hero from "../components/home/Hero";
import Recreate from "../components/home/Recreate";
import TemplateGallery from "../components/home/TemplateGallery";
import Editor from "../components/home/Editor";
import { SITE } from "../data/site";

// Sections below the editor load after the first paint.
const MyTemplates = lazy(() => import("../components/home/MyTemplates"));
const Community = lazy(() => import("../components/home/Community"));
const ClosingNote = lazy(() => import("../components/home/ClosingNote"));

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  applicationCategory: "BusinessApplication",
  operatingSystem: "Any",
  description:
    "Make, save and share document templates such as resumes, cover letters and demand letters. Work stays on your device unless you choose to share it.",
};

export default function Home() {
  return (
    <Page
      title="Turn any form into a template"
      description="Upload a scan or describe a form, plot its points and get a fill-in template with live preview and PDF download. Work stays on your device."
      jsonLd={jsonLd}
    >
      <Hero />
      <Recreate />
      <TemplateGallery />
      <Editor />
      <Suspense fallback={<div className="min-h-[40vh]" aria-hidden="true" />}>
        <MyTemplates />
        <Community />
        <ClosingNote />
      </Suspense>
    </Page>
  );
}
