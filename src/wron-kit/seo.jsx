// <Seo title="..." description="..." /> on every page.
//
// In the browser it sets the tab title and the meta tags as the visitor moves
// between pages. When Wron prerenders a published page there is no browser: the
// tags are collected instead and written into that page's own HTML, which is what
// search engines and link previews (iMessage, Slack, X) actually read.
import { useEffect } from "react";
import { isServer } from "./runtime.js";

function siteInfo() {
  const info = typeof window !== "undefined" ? window.__WRON__ && window.__WRON__.site : globalThis.__WRON_SITE__;
  return info || {};
}

function setMeta(attr, key, value) {
  if (!value) return;
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLdJson(data) {
  const id = "wron-ld-json";
  let el = document.getElementById(id);
  if (!data) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * title       the page's own title; the site name is appended ("Menu | Chambers Cafe")
 * description one or two sentences for search results (under ~155 characters)
 * image       an absolute image URL for link previews
 * noindex     keep this page out of search results (account pages, thank-you pages)
 * jsonLd      structured data (schema.org), e.g. a LocalBusiness or Product object
 */
export function Seo({ title, description, image, noindex = false, jsonLd }) {
  const site = siteInfo();
  const full = title && site.name && title !== site.name ? `${title} | ${site.name}` : title || site.name || "";
  const desc = description || site.description || "";
  const img = image || site.image || "";

  if (isServer && globalThis.__WRON_HEAD__) {
    globalThis.__WRON_HEAD__.push({ title: full, description: desc, image: img, noindex, jsonLd: jsonLd || null });
  }

  useEffect(() => {
    if (full) document.title = full;
    setMeta("name", "description", desc);
    setMeta("property", "og:title", full);
    setMeta("property", "og:description", desc);
    setMeta("property", "og:image", img);
    setMeta("name", "twitter:card", img ? "summary_large_image" : "summary");
    setMeta("name", "robots", noindex ? "noindex" : "index,follow");
    setLdJson(jsonLd || null);
  }, [full, desc, img, noindex, jsonLd]);

  return null;
}
