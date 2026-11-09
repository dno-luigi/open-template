// One place for the site's facts. Read these everywhere; never retype them.
export const SITE = {
  name: "Open Template Library",
  url: "https://templates.nspired.cc",
  domain: "templates.nspired.cc",
  phone: "8588765295",
  phoneHref: "tel:8588765295",
};

export const PRIVACY_LINE = "Privacy first. Work stays on this device unless you choose to share it.";
export const PRIVACY_SHORT = "Work stays on this device unless you choose to share it.";

export const NAV = [
  { id: "recreate", label: "Recreate" },
  { id: "templates", label: "Templates" },
  { id: "editor", label: "Editor" },
  { id: "my-templates", label: "My templates" },
  { id: "community", label: "Community" },
];

// Confirmed example categories. More chips come only from categories that exist in the community data.
export const CATEGORIES = ["Resumes", "Cover letters", "Demand letters"];
export const ALL_CATEGORIES = "All categories";

export const LEGAL_NOTE_DEMAND = "Demand letter templates are not legal advice.";

export const STATUS = {
  device: "On this device only",
  shared: "Shared with community",
};

// Still picture of the paper, used as the 3D poster and the no-WebGL fallback.
export const PAPER_POSTER =
  "https://firebasestorage.googleapis.com/v0/b/wron-ai.firebasestorage.app/o/site-assets%2Fsite-1793848279712%2F43a20c54-4da9-44bb-b004-d13cad478eab.webp?alt=media&token=717459c0-4636-4922-aec3-f4843edf6240";

// Wron Cloud tables (see db/schema.json)
export const TABLES = {
  community: "community_templates", // public: published community templates
  submissions: "shared_templates", // submit: shares from visitors, no account needed
  reports: "template_reports", // submit: reports on community templates
  copies: "template_copies", // submit: one row each time a template is copied
};
