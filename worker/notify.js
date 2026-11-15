// Telling the owner a share arrived, so the queue doesn't have to be watched.
//
// Two ways out, tried in this order, first one that works wins:
//
//   1. Cloudflare Email Routing — the NOTIFY binding in wrangler.jsonc. Sending
//      this way costs nothing and needs no key, but Cloudflare only allows it
//      once Email Routing is enabled for the domain in NOTIFY_FROM (Zone → Email
//      → Email Routing) and the destination is a verified address there.
//   2. Resend — POST /emails with RESEND_API_KEY. Enable the key and verify a
//      sending domain at resend.com and notifications go out with no Cloudflare
//      mail setup at all.
//
// A failed send is logged and reported as notified:false. The share is already
// stored by then, and losing a submission over an undelivered note would be the
// worse outcome, so this never throws.
const QUEUE_URL = "https://forms.nspired.cc/#review";
const RESEND_URL = "https://api.resend.com/emails";
const MAX_SUBJECT = 120;

/** Titles and names are typed by visitors: keep them to one line and a length. */
function oneLine(value, max) {
  return String(value == null ? "" : value)
    .replace(/[\r\n\t]+/g, " ")
    .trim()
    .slice(0, max);
}

function describe(share, when) {
  return [
    `${share.title} is waiting in the review queue.`,
    "",
    `Title:     ${share.title}`,
    `Category:  ${share.category || "uncategorised"}`,
    `From:      ${share.author || "anonymous"}`,
    `Arrived:   ${when}`,
    "",
    `Review it: ${QUEUE_URL}`,
    "",
    "It stays out of the community list until you publish it there.",
  ].join("\n");
}

/** Email Routing's binding. Throws with Cloudflare's own reason. */
async function viaCloudflare(env, message) {
  await env.NOTIFY.send(message);
}

/** Resend's one endpoint. Throws with whatever it said went wrong. */
async function viaResend(env, message) {
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      text: message.text,
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`resend ${response.status}: ${detail.slice(0, 300)}`);
  }
}

/**
 * Send one note about one share.
 * Returns { sent: true, via } or { sent: false, reason } — never throws.
 */
export async function notifyShare(env, share) {
  const to = String(env.OWNER_EMAIL || "").trim();
  if (!to) return { sent: false, reason: "no_owner_email" };

  const title = oneLine(share.title, MAX_SUBJECT) || "Untitled";
  const message = {
    from: String(env.NOTIFY_FROM || "forms@nspired.cc").trim(),
    to,
    subject: `New share: ${title}`,
    text: describe(
      { ...share, title, category: oneLine(share.category, 60), author: oneLine(share.author, 60) },
      share.when || new Date().toISOString()
    ),
  };

  const senders = [];
  if (env.NOTIFY && typeof env.NOTIFY.send === "function") senders.push(["cloudflare", viaCloudflare]);
  if (env.RESEND_API_KEY) senders.push(["resend", viaResend]);
  if (!senders.length) return { sent: false, reason: "no_sender" };

  for (const [name, send] of senders) {
    try {
      await send(env, message);
      return { sent: true, via: name };
    } catch (error) {
      console.error(`notify via ${name} failed:`, error && error.message ? error.message : error);
    }
  }
  return { sent: false, reason: "send_failed" };
}
