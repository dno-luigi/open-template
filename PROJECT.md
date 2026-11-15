# Judicial Council Form Decryption & Fillable Templates

## Core Capability

We can take a previously encrypted court PDF, remove the document encryption—using a blank password for the Judicial Council forms and a crypto-capable PDF backend for the San Diego forms—recover the AcroForm field layer, and turn it into a reusable fillable template with exact page geometry.

This is not a one-off. The same pattern has been repeated across eight forms:

- Judicial Council FL-320
- Judicial Council FL-150
- San Diego D-001, D-046, D-049, D-305, FCS-046, and FLF-001

The Judicial Council forms were the easy case. They were not password-protected in the user-facing sense: there was no password to enter, and the encryption came off with a blank password. The San Diego forms are where the crypto backend was required.

The result is better than a browser run or a vision pass for native fillable forms because we recover the form's actual field definitions, not an approximation of the page.

## The Pattern

1. **Detect encryption.** Read the PDF's `/Encrypt` dictionary and security handler.
2. **Decrypt.** Remove the encryption while preserving pages, text, and form objects. For the Judicial Council forms this is a blank-password removal; for San Diego it required the crypto backend.
3. **Verify the decrypted file.** Confirm `/Encrypt` is gone, the page count is unchanged, and the field tree is readable.
4. **Extract AcroForm widgets.** Capture each field's original name, type, page, rectangle, options, and read-only state.
5. **Extract positioned text.** Keep the printed labels and their coordinates so the fields can be understood in context.
6. **Normalize the template.** Assign a stable key and human-readable label to every field.
7. **Fill the original PDF.** Write values directly into the decrypted document at the extracted rectangles.
8. **Render a review card.** Optionally show the filled form as an editable HTML/PDF card for checking and printing.

Step 2 is mandatory. A field extractor alone cannot read a document that is still encrypted. The Judicial Council forms simply used a blank password; the San Diego set is what required the crypto backend.

## Encryption Evidence

The Judicial Council forms did not prompt for a password. They carried document encryption with a blank password, which is why they were the easier case.

The six San Diego originals all contain an `/Encrypt` marker:

```text
artifacts/sandiego/family-law/d001.pdf
artifacts/sandiego/family-law/d046.pdf
artifacts/sandiego/family-law/d049.pdf
artifacts/sandiego/family-law/d305.pdf
artifacts/sandiego/family-law/fcs046.pdf
artifacts/sandiego/family-law/flf001.pdf
```

Five of them expose the AESV3 profile:

```text
/CFM/AESV3
/Length 256
/R 6
/V 5
```

D-046 is a clear example:

```text
<</CF<</StdCF<</AuthEvent/DocOpen/CFM/AESV3/Length 32>>>>
/Filter/Standard/Length 256/R 6/StmF/StdCF/StrF/StdCF/V 5>>
```

The corresponding decrypted copies contain no `/Encrypt` marker:

```text
artifacts/sandiego/family-law/d001-decrypted.pdf
artifacts/sandiego/family-law/d046-decrypted.pdf
artifacts/sandiego/family-law/d049-decrypted.pdf
artifacts/sandiego/family-law/d305-decrypted.pdf
artifacts/sandiego/family-law/fcs046-decrypted.pdf
artifacts/sandiego/family-law/flf001-decrypted.pdf
```

That is the cryptographic step: the original is locked at the document level, and the decrypted copy exposes the normal PDF objects and AcroForm tree.

This is document-level encryption, not a claim about cracking a user's password. The Judicial Council forms had a blank password; San Diego is where the crypto backend was necessary.

## What the Decryption Unlocks

Once the file is open, the PDF itself supplies the template:

| Form | Pages | AcroForm widgets | Extraction time |
| --- | ---: | ---: | ---: |
| FL-320, Rev. July 1, 2025 | 2 | 85 (37 text, 48 checkbox/button) | 83 ms |
| FL-150, Rev. January 1, 2007 | 4 | 262 (212 text, 50 checkbox/button) | 197 ms |

For FL-320 and FL-150 we produced:

- `fields.json` — page, original name, type, rectangle, value, and options for every widget.
- `template.json` — positioned text plus the field geometry, keyed by page.
- A decrypted source PDF that preserves the official layout.

The FL-320 fields are easy to understand because the names are descriptive:

```text
FL-320[0].Page1[0].P1Caption_sf[0].CaptionSub[0].CaseNumber[0].CaseNumber_ft[0]
FL-320[0].Page1[0].P1Caption_sf[0].AttyInfo[0].AttyName_ft[0]
```

FL-150 is the harder case. Most widgets use generated names:

```text
FillText193
FillText191
FillText190
```

The geometry is exact, but the name does not say "attorney name" or "case number." That is the next mapping layer, not a decryption problem.

## Why This Beats Browser Run and Vision

For a native fillable PDF, browser screenshots and vision models are working from pixels. They do not recover the field tree.

| Path | Time | What it returns | Accuracy |
| --- | ---: | --- | --- |
| Crypto + AcroForm | 83–197 ms per form | Exact field names, rectangles, types, options | Exact geometry |
| Browser Run | 4.9–5.6 s per page capture | Screenshot | No field map |
| Vision model | 8–33 s per test | Approximate boxes and labels | 0–75% coverage in the FL-150 tests |

The measured cost of the crypto + AcroForm path is roughly **$0.0003–$0.0006 per digital form**, with no model call. The vision fallback is roughly **$0.0025–$0.005 per 2–4 page form** and still has to be checked.

Vision is still useful for flat scans and image-only forms. It should be the fallback, not the default.

## What Population Looks Like

The extracted field map is the contract. Once it exists, values can come from anywhere:

- a structured intake form
- voice transcription
- an AI extraction step
- a card merge
- manual entry

The fill step writes those values into the original decrypted PDF at the exact rectangles. A second rendering path produces an editable HTML card for review, print, and save-as-PDF.

For court forms, filling the original PDF is the preferred path. The HTML card is a review layer, not a replacement for the official form.

## What Exists Now

- `artifacts/fl320/fields.json` — 85 FL-320 widgets.
- `artifacts/fl320/template.json` — FL-320 page text and field geometry.
- `artifacts/fl320/fl320-decrypted.pdf` — decrypted FL-320 source.
- `fl320.html` — two-page editable FL-320 reproduction with contenteditable fields, checkboxes, highlighting, print preview, save, clear, and print-to-PDF.
- `artifacts/fl150/fields.json` — 262 FL-150 widgets.
- `artifacts/fl150/template.json` — FL-150 page text and field geometry.
- `artifacts/fl150/fl150-decrypted.pdf` — decrypted FL-150 source.
- `artifacts/fl150/fl150-fields-map.json` — 260 normalized field records, still without human labels.
- `artifacts/fl150/fl150-fillable.pdf` — fillable FL-150.
- `artifacts/fl150/fl150-filled-sample.pdf` — filled sample.
- `artifacts/sandiego/family-law/` — six encrypted originals, six decrypted copies, and a filled D-046 sample.
- `artifacts/cost-model.md` — extraction, page-capture, and form-conversion costs.

## What Is Proven vs. What Is Packaged

Proven:

- Judicial Council PDFs can be decrypted with a blank password and made fillable.
- San Diego PDFs can be decrypted with the crypto backend and made fillable.
- The field layer can be extracted with exact geometry.
- The pattern repeats across Judicial Council and San Diego forms.
- A decrypted form can be filled and rendered as a PDF or an editable card.

Not yet packaged:

- A single checked-in command that runs decrypt → extract → label → fill end to end.
- A complete human-readable label map for FL-150.
- A production route that loads these templates into the card workflow.

The capability is real; the repeatable product wrapper is the remaining work.

## Next Work

1. Package the exact crypto + extraction sequence as one command.
2. Add label maps, starting with FL-320's descriptive names and then FL-150's generated names.
3. Fill the original decrypted PDFs from a JSON value set and compare them to the official render.
4. Connect the template schema to intake cards → field values → filled PDF card.
5. Keep missing values visible. Never fabricate a field value to make a form look complete.
