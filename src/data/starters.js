// Starter templates: real letter-format pages with the fields a person fills in.
// Nothing here is a claim about anyone. Every name, date and address is a field to fill.
import { newDoc, textBlock, fieldBlock, ruleBlock } from "../components/templateStore";

const f = (label, o) => fieldBlock(label, "", o);
const t = (text, o) => textBlock(text, o);
const sp = () => textBlock("");
const hr = () => ruleBlock();

const letterhead = () => [
  f("Your name", { variant: "name" }),
  f("Street address"),
  f("City, state, ZIP"),
  f("Phone or email"),
  hr(),
  sp(),
];
const recipient = () => [
  f("Date"),
  sp(),
  f("Recipient name"),
  f("Company or title"),
  f("Street address"),
  f("City, state, ZIP"),
  sp(),
];
const signoff = (close = "Sincerely,") => [sp(), t(close), sp(), sp(), f("Your name")];

export const STARTERS = [
  {
    key: "business-letter",
    name: "Business letter",
    build: () =>
      newDoc({
        title: "Business letter",
        category: "Business letters",
        printTitle: false,
        blocks: [
          ...letterhead(),
          ...recipient(),
          f("Salutation"),
          sp(),
          t(
            "State why you are writing in one sentence.\n\nGive the details the reader needs: dates, amounts, names and what happened.\n\nSay what you want to happen next, and thank the reader for their time."
          ),
          ...signoff(),
        ],
      }),
  },
  {
    key: "cover-letter",
    name: "Cover letter",
    build: () =>
      newDoc({
        title: "Cover letter",
        category: "Cover letters",
        printTitle: false,
        blocks: [
          ...letterhead(),
          ...recipient(),
          f("Salutation"),
          sp(),
          t(
            "I am applying for the role you posted. Name the job title and where you saw it.\n\nShow how your experience fits the work. Use one or two clear examples, with numbers if you have them.\n\nSay why this company interests you and what you would bring to the team.\n\nThank you for your time. I would welcome a conversation."
          ),
          ...signoff(),
        ],
      }),
  },
  {
    key: "resume",
    name: "Resume",
    build: () =>
      newDoc({
        title: "Resume",
        category: "Resumes",
        printTitle: false,
        font: "sans",
        margin: "0.75",
        blocks: [
          f("Your name", { variant: "name", align: "center" }),
          f("City, state | Phone | Email", { align: "center" }),
          sp(),
          t("Summary", { variant: "heading" }),
          t("Two sentences about the work you do and what you do best."),
          t("Experience", { variant: "heading" }),
          t("Job title, Company", { variant: "bold" }),
          t("City, state | Start date to end date"),
          t("• A result you achieved, with a number if you have one.\n• Something you were responsible for.\n• A skill you used."),
          sp(),
          t("Job title, Company", { variant: "bold" }),
          t("City, state | Start date to end date"),
          t("• A result you achieved.\n• Something you were responsible for."),
          t("Education", { variant: "heading" }),
          t("Degree, School", { variant: "bold" }),
          t("City, state | Year"),
          t("Skills", { variant: "heading" }),
          t("Skill, skill, skill, skill"),
        ],
      }),
  },
  {
    key: "demand-letter",
    name: "Demand letter",
    build: () =>
      newDoc({
        title: "Demand letter",
        category: "Demand letters",
        printTitle: false,
        blocks: [
          // Copied from the demand template in ai-NCards: the same lines, the same
          // order, centred. Nothing personal is in it, so nothing had to be removed.
          t("FORMAL CORRESPONDENCE", { variant: "label", align: "center" }),
          sp(),
          t("Sender Name", { variant: "name", align: "center" }),
          sp(),
          t("IN PROPRIA PERSONA", { variant: "label", align: "center" }),
          hr(),
          sp(),
          t("Sender Name", { variant: "bold", align: "center" }),
          t("Street Address", { align: "center" }),
          t("City, State ZIP", { align: "center" }),
          t("Phone • Email", { align: "center" }),
          t("Date: DATE", { align: "center" }),
          sp(),
          t("VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED", { variant: "bold", align: "center" }),
          sp(),
          t("TO:", { variant: "bold", align: "center" }),
          sp(),
          t("Recipient Name", { variant: "bold", align: "center" }),
          sp(),
          t("Recipient Title", { align: "center" }),
          t("Organization Name", { align: "center" }),
          t("Street Address", { align: "center" }),
          t("City, State ZIP", { align: "center" }),
        ],
      }),
  },
  {
    key: "responsive-declaration",
    name: "Responsive declaration",
    build: () =>
      newDoc({
        title: "Responsive declaration to request for order",
        category: "Court forms",
        printTitle: false,
        font: "sans",
        margin: "0.75",
        blocks: [
          t("Responsive declaration to request for order", { variant: "name" }),
          t("A plain fill-in layout in the style of form FL-320. It is not the official court form and it is not legal advice.", { variant: "body" }),
          hr(),
          t("Your information", { variant: "heading" }),
          f("Your name"),
          f("Street address, city, state, ZIP"),
          f("Phone or email"),
          t("Court and case", { variant: "heading" }),
          f("Court name and address"),
          f("Case number"),
          f("Petitioner"),
          f("Respondent"),
          f("Hearing date, time and department"),
          t("1. Orders I agree to", { variant: "heading" }),
          t("List the orders in the other side's request that you agree to."),
          f("Orders I agree to"),
          t("2. Orders I do not agree to", { variant: "heading" }),
          t("List each order you do not agree to. Say what you ask the court to order instead."),
          f("Orders I do not agree to"),
          f("What I ask the court to order instead"),
          t("3. Other orders I request", { variant: "heading" }),
          t("Child custody and parenting time, child support, spousal support, property, attorney fees, or other. Delete what does not apply."),
          f("Other orders I request"),
          t("4. Facts that support my response", { variant: "heading" }),
          t("Write short, numbered facts in your own words. Include dates and what you saw or did yourself."),
          f("Fact 1"),
          f("Fact 2"),
          f("Fact 3"),
          t("Declaration", { variant: "heading" }),
          t("I declare under penalty of perjury under the laws of the State of California that the information above is true and correct."),
          sp(),
          f("Date"),
          sp(),
          sp(),
          f("Your signature, printed name"),
          sp(),
          t("Check the current official form and the court's rules before you file."),
        ],
      }),
  },
  {
    key: "reference-letter",
    name: "Reference letter",
    build: () =>
      newDoc({
        title: "Reference letter",
        category: "Reference letters",
        printTitle: false,
        blocks: [
          ...letterhead(),
          f("Date"),
          sp(),
          t("To whom it may concern:"),
          sp(),
          t(
            "Say who you are recommending, how you know them and for how long.\n\nDescribe two or three strengths. Give a short example of each.\n\nEnd by saying you recommend them, and how the reader can reach you."
          ),
          ...signoff(),
        ],
      }),
  },
  {
    key: "meeting-notes",
    name: "Meeting notes",
    build: () =>
      newDoc({
        title: "Meeting notes",
        category: "Meeting notes",
        printTitle: false,
        font: "sans",
        blocks: [
          t("Meeting notes", { variant: "name" }),
          f("Date"),
          f("Attendees"),
          hr(),
          t("Agenda", { variant: "heading" }),
          t("• Topic one\n• Topic two"),
          t("Notes", { variant: "heading" }),
          t("Write what was said."),
          t("Decisions", { variant: "heading" }),
          t("• Decision"),
          t("Action items", { variant: "heading" }),
          t("• Person: task, due date"),
        ],
      }),
  },
];
