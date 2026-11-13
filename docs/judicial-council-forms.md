# Judicial Council forms: the real forms are downloadable and fillable

Recorded 2026-11-12, from the owner: *"we can get any form we want to from the
judicial council of California and the unlock or decryption password is blank."*
Checked against the live site before writing it down as fact.

## What was verified

    curl -L https://www.courts.ca.gov/documents/ud105.pdf   -> 200, 209,269 bytes, 4 pages
    curl -L https://www.courts.ca.gov/documents/fl320.pdf   -> 200, 106,370 bytes, 2 pages

Both files are **encrypted PDFs and the blank password opens them** (`decrypt("")`
succeeds). They can be read, filled and re-saved with no password, key or vendor.

Both are **AcroForm documents** with usable fields:

| Form | Pages | Fields | Fillable |
|---|---|---|---|
| UD-105 (Answer — Unlawful Detainer) | 4 | 196 | 105 |
| FL-320 (Responsive Declaration to Request for Order) | 2 | 134 | — |

Field names are hierarchical and ugly (`UD-105[0].Page1[0].P1Caption[0]...CaseNumber[0]`),
but most carry a human `/TU` label that is exactly what a person needs to map:

| `/TU` label | field | type |
|---|---|---|
| `SUPERIOR COURT OF CALIFORNIA, COUNTY OF` | `CrtCounty[0]` | text |
| `CASE NUMBER:` | `CaseNumber[0]` | text |
| `PLAINTIFF:` | `Party1[0]` | text |
| `DEFENDANT:` | `Party2[0]` | text |
| `General Denial …` | `Check1[0]` | checkbox |
| `On (date):` | `Date1[0]` | text |

**Map by `/TU` label, not by field name.** Names change between revisions of the
same form; the labels are what the form is asking.

## Why this matters for the product

An unlawful detainer answer is not a letter and not a lookalike page: it is
UD-105, on the form the court prints, or on pleading paper. Drawing our own
"Answer — Unlawful Detainer" page and calling it a filing is the wrong artifact,
and that is what the generator was producing before this note.

The right pipeline is: pick the official form → fill its AcroForm fields from the
audit and the description → hand back the real PDF with only the person's own
blanks left empty. Partially filled, on the actual form.

## The URL pattern

    https://www.courts.ca.gov/documents/<form-number-lowercase-no-dash>.pdf

`UD-105` -> `ud105.pdf`, `FL-320` -> `fl320.pdf`, `UD-100` -> `ud100.pdf`. The
redirecting `301` means a plain `curl` needs `-L`. Form index pages live at
`selfhelp.courts.ca.gov/jcc-form/<FORM>`.

## Practical notes for whoever builds this

- Checkbox fields are `/Btn`. Setting `/V` alone is often not enough for every
  viewer: also set the `/AS` appearance state (usually `/Yes` / `/Off`) on the
  widget, or the box looks empty when printed.
- Fill with a library that preserves AcroForm (`pypdf` reads and writes them;
  `pdf-lib` in the Worker/browser does too). Do not rasterise — the point is a
  form the court accepts.
- Keep the form's own fields intact so the person can still complete it by hand.
- Do not invent values. A field with no answer from the record stays empty.
- The forms are public records, but they are copyrighted by the Judicial Council;
  filling them for a filer is the intended use, redistributing a modified blank
  form is not.

## What was built (v1, this repo)

- `public/forms/ud105.pdf` and `fl320.pdf` are the Council's blanks, decrypted once with
  the blank password, beside a `*.json` map of semantic key -> field name and label.
- `worker/jcf.js` (`POST /api/site/:siteId/jcf`) plans values from the audit and the
  description, fills the real fields with pdf-lib, and returns the PDF. `dry: true`
  returns the same plan plus the list of blanks the record could not answer.
- `src/components/home/CourtFormDialog.jsx` shows what the audit filled and turns each
  remaining blank into a question card; the answers go back onto the form.
- Two forms only, deliberately: UD-105 for an eviction answer, FL-320 for a response to
  a request for order. The packet and exhibits stay at EZXHIBITZ.
