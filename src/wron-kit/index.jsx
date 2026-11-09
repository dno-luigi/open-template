// "@wron/kit": everything a generated site imports from Wron. See
// src/lib/site/prompt.ts for how the model is taught to use it.
import { PageFade } from "./motion.jsx";
import { Seo } from "./seo.jsx";

export { cn, isPreview, isLive, storage, scrollToSection } from "./runtime.js";
export { Seo } from "./seo.jsx";
export { Img } from "./image.jsx";
export {
  Reveal, Stagger, StaggerItem, PageFade, Parallax, Marquee, CountUp, SplitText, Magnetic, Tilt,
  ScrollProgress, StackCards, HorizontalScroll, ClipReveal, ScrollText, EASE_OUT,
} from "./motion.jsx";
export {
  Grain, SmartHeader, Wordmark, Spotlight, RotatingWord, ExpandMedia, StickySteps, Timeline,
  OpenNow, HoursTable, openStatus, StickyActions, RollText, Masonry,
} from "./signature.jsx";
export { Dialog, Sheet, Accordion, AccordionItem, Tabs, Carousel, BeforeAfter, toast, useDisclosure, CookieSettingsLink } from "./ui.jsx";
export { BookingEmbed, MapEmbed, VideoEmbed } from "./embeds.jsx";
export { Widget, Embed } from "./widgets.jsx";
export {
  submitForm, useForm, SpamTrap, table, useTable, useRow, auth, useUser, SignedIn, SignedOut, RequireSignIn,
  upload, checkout, useCart, money, useCheckoutResult, useOrder, ai, CloudError, appointments, useAvailability,
  owner, useOwner, OwnerOnly, useLanguage,
} from "./cloud.js";
export { useLive, freshness } from "./live.js";
export {
  OwnerComposioGate, OwnerToolError, connectOwnerComposio, disconnectOwnerComposio,
  useOwnerComposio, listOwnerComposioTools, readOwnerComposio,
} from "./composio.js";
export {
  VisitorComposioGate, VisitorToolError, connectVisitorComposio,
  useVisitorComposio, refreshVisitorComposio, listVisitorComposioTools, readVisitorComposio,
} from "./composio-visitor.js";

/**
 * Every page's outer element: sets the page's search/link-preview tags and fades
 * the page in. <Page title="Menu" description="Seasonal plates and natural wine.">...</Page>
 */
export function Page({ title, description, image, noindex, jsonLd, className, children, as = "main" }) {
  return (
    <PageFade as={as} className={className}>
      <Seo title={title} description={description} image={image} noindex={noindex} jsonLd={jsonLd} />
      {children}
    </PageFade>
  );
}
