export interface FAQItem {
  question: string
  answer: string
}

export interface LandingConfig {
  /** URL path without the leading slash. */
  slug: string
  /** Used in headings, schema names and body copy. Sentence case. */
  documentType: string
  H1Title: string
  metaDescription: string
  /** One paragraph under the H1, above the tool. */
  intro: string
  targetedFAQ: FAQItem[]
}

/**
 * One entry per high-intent search route. Everything a landing page needs to
 * differ from its siblings lives here — the template reads it and nothing else,
 * so adding a sixth document type is a data change, not a code change.
 */
export const LANDINGS: LandingConfig[] = [
  {
    slug: 'redact-bank-statement',
    documentType: 'bank statement',
    H1Title: 'Redact Bank Statements Online (100% Private & Free)',
    metaDescription:
      'Black out balances, account numbers and transactions on a bank statement in your browser. No upload, no account, no server — the file never leaves your device.',
    intro:
      'Cover the balance, the account number, or every transaction line before you send a statement to a landlord, lender or accountant. The file is opened by your own browser and never transmitted anywhere.',
    targetedFAQ: [
      {
        question: 'Why does it matter where a bank statement gets redacted?',
        answer:
          'A statement is the densest financial document most people own. It carries the account and routing numbers, the running balance, the employer name on every deposit, and a line-by-line record of where you shop, who you pay rent to, which pharmacy you use and which solicitor you retained. Upload that to a cloud redaction site and all of it lands on someone else\'s disk — in temporary storage, in nightly backups, in request logs — for as long as a retention policy you cannot audit says it should. RedactLocal never transmits the file, so there is nothing to retain, leak or subpoena.',
      },
      {
        question: 'I only need to hide a few lines for my landlord. Is a cloud tool good enough?',
        answer:
          'Letting agents usually ask for two or three months of statements to prove income. They need the deposits; they do not need your balance or your spending history. The risk was never the landlord — it is the chain of copies the document makes on its way there: the upload, the processing server, the agent\'s inbox, and the property management system it eventually gets filed in. Producing the redacted copy locally cuts that chain down to the single file you chose to send.',
      },
      {
        question: 'Will a mortgage underwriter accept a redacted statement?',
        answer:
          'Ask before you redact. Underwriters generally require complete statements for the accounts used to qualify, but will often accept redaction on unrelated accounts, or on transaction detail for accounts you are disclosing only for completeness. Where redaction is permitted, what they care about is that it is irreversible — and a black rectangle drawn over live text in a PDF editor is not.',
      },
      {
        question: 'Can the hidden numbers be recovered from the file I download?',
        answer:
          'No. RedactLocal does not lay a shape on top of your text. Every page is rasterised to an image, the black boxes are burned into those pixels, and the exported PDF is rebuilt from the images alone, so the text layer, the fonts and the metadata of the original have no route into it. Once the file is built the app re-opens it and reports how many characters are still selectable. The answer is zero.',
      },
    ],
  },
  {
    slug: 'redact-tax-forms',
    documentType: 'tax form',
    H1Title: 'Blackout SSN & Tax Forms Without Uploading Files',
    metaDescription:
      'Hide your Social Security number on a W-2, 1099 or tax return without uploading it. Runs entirely in your browser — free, no account, works offline.',
    intro:
      'Black out the Social Security number, the employer identification number, or an entire income line on a W-2, 1099 or filed return before you share it with a lender, a school or a landlord.',
    targetedFAQ: [
      {
        question: 'Why is a Social Security number worth this much care?',
        answer:
          'Unlike a card number, an SSN cannot be reissued after a breach in any practical sense — it follows you for life, and it is the single credential that opens new credit lines, files a fraudulent return in your name, or claims your refund before you do. Refund fraud in particular depends on nothing more than a name, a date of birth and an SSN. A tax document hands over all three on one page, which is why the copy you send should carry only the part the recipient actually needs.',
      },
      {
        question: 'Who typically needs a tax form with the SSN removed?',
        answer:
          'Mortgage and rental applications, income verification for a lease, financial aid paperwork, immigration sponsorship packets and small-claims filings all commonly ask for a return or a W-2 while having no legitimate need for the full identifier. Many institutions explicitly ask for the last four digits only. Cover the first five and you have satisfied the request without handing over the rest.',
      },
      {
        question: 'Is it safe to run a tax return through an online PDF tool?',
        answer:
          'A cloud tool has to receive the document to work on it, which means your return exists on infrastructure you do not control, governed by a privacy policy that can change. Several popular "free PDF" sites are ad-supported, and the ad stack is the part most likely to be reading your page. RedactLocal loads no third-party script at all: turn your Wi-Fi off and every step still runs, because there is nothing on the other end of a connection to wait for.',
      },
      {
        question: 'Does the export really destroy the number, or just hide it?',
        answer:
          'It destroys it. The page is converted to an image with the black box painted into the pixels, and a fresh PDF is assembled from those images, so there is no text layer left to search, select or copy. The app then re-opens its own output and counts what remains: zero characters, zero fonts, zero annotations.',
      },
    ],
  },
  {
    slug: 'redact-passport-id',
    documentType: 'passport or ID card',
    H1Title: 'Free Passport & ID Card Photo Redactor',
    metaDescription:
      'Black out a passport number, MRZ strip or ID card details in your browser. Nothing is uploaded — the scan of your identity document never leaves your device.',
    intro:
      'Cover the document number, the machine-readable strip, or the date of birth on a scan of a passport, driving licence or national ID before you send it to anyone.',
    targetedFAQ: [
      {
        question: 'Which parts of a passport scan should be covered?',
        answer:
          'The two lines of dense characters at the bottom — the machine-readable zone — encode your document number, nationality, date of birth, sex and expiry in a form built for machines to lift instantly, so they deserve the most attention. Beyond that, the document number itself, the personal number where your country prints one, and the date of birth are the fields that turn a scan into a usable identity kit. What most recipients genuinely need is the photo page as proof that the document exists and matches your face.',
      },
      {
        question: 'Why not just crop the image instead?',
        answer:
          'Cropping is a reasonable instinct, but in a PDF a crop is frequently a display instruction rather than a deletion — the full page can still sit in the file, recoverable by anyone who opens it with the right tool. This is the same trap as drawing a black rectangle in a PDF editor. Flattening the page to pixels and rebuilding the file from those pixels is what makes the removal real.',
      },
      {
        question: 'I have to upload ID to verify an account. Does this still help?',
        answer:
          'Often, yes. Identity checks for exchanges, gig platforms, rental agencies and hotels frequently accept a document with selected fields obscured, and some publish exactly which fields they need. Where a verification provider requires the full document, redaction is not appropriate — but for the many everyday requests that are really just proof of identity, sending less is both accepted and sensible.',
      },
      {
        question: 'Does the scan of my ID get sent anywhere while I work on it?',
        answer:
          'No. The file is read into the tab by the browser\'s own FileReader and rendered on a canvas. There is no account, no queue and no server component to this tool. Switch off your network connection and the whole workflow — opening, drawing, exporting — still completes.',
      },
    ],
  },
  {
    slug: 'redact-w9-form',
    documentType: 'W-9 form',
    H1Title: 'Redact W9 Forms & Financial Records Locally',
    metaDescription:
      'Black out the TIN, EIN or SSN on a W-9 before sending it to a client. Runs entirely in your browser — no upload, no account, free.',
    intro:
      'Cover the taxpayer identification number, the signature or the home address on a W-9 or vendor record before it goes into a client portal or an accounts-payable inbox.',
    targetedFAQ: [
      {
        question: 'What actually happens to the W-9s a contractor sends out?',
        answer:
          'A working freelancer may send the same form to a dozen clients a year. Each copy lands in an accounts-payable mailbox, gets forwarded to a bookkeeper, is uploaded to a vendor portal, and is retained for years by every one of those systems. You are not trusting one company with your taxpayer identification number; you are trusting all of them, plus whichever contractors and platforms they use, indefinitely. Every copy that leaves with less on it is one fewer place a full identifier can surface.',
      },
      {
        question: 'Can I redact a W-9 and still have it be valid?',
        answer:
          'It depends on who is asking and why. A client who must file a 1099 for you needs the identification number, so redacting it there defeats the purpose. But W-9s are routinely requested for onboarding, procurement records and vendor databases well before — sometimes instead of — any filing obligation, and those requests can often be met with the number withheld until it is genuinely required. The other fields are worth a second look too: many forms carry a home address and a wet signature that nobody in procurement needs.',
      },
      {
        question: 'Why not use the free PDF editor that came up first in search?',
        answer:
          'Most of those are cloud services: the file is uploaded, processed on their servers and stored for some window afterwards. For a document whose entire sensitivity is a single nine-digit number, that is a poor trade. RedactLocal does the work in the tab you already have open, and loads no third-party or advertising script that could read the page.',
      },
      {
        question: 'How do I know the number is really gone from the file I send?',
        answer:
          'The export is not your original with boxes added. Each page is rasterised, the boxes are burned into the pixels, and a new PDF is built from those images, leaving no text layer, fonts or original metadata behind. The app then re-opens its own output and reports the count of selectable characters, which is zero.',
      },
    ],
  },
  {
    slug: 'blackout-invoice-pdf',
    documentType: 'invoice',
    H1Title: 'Censor Invoice Balances & Client Details Offline',
    metaDescription:
      'Black out client names, rates and balances on an invoice PDF in your browser. Nothing is uploaded — useful for portfolios, disputes and case studies.',
    intro:
      'Cover client names, line-item rates or the outstanding balance on an invoice before it goes into a portfolio, a case study, an expense claim or a dispute.',
    targetedFAQ: [
      {
        question: 'Why do invoices need redacting at all?',
        answer:
          'An invoice is a contract\'s pricing laid bare. It names the client, itemises what they bought, and states what you charged — which is exactly the information a competitor would like, and frequently the information a confidentiality clause forbids you to disclose. The moment an invoice leaves its original context, whether into a portfolio, a funding application or a public dispute, it usually needs to carry less than it did.',
      },
      {
        question: 'What should I cover for a portfolio or case study?',
        answer:
          'Keep what proves the point and cover the rest. Prospective clients want evidence of scope and outcome, not your day rate with a previous customer — publishing that anchors every future negotiation against you. The client\'s name, their address and contact, per-line pricing and the total are the usual candidates. If your contract has a confidentiality clause, check it before publishing anything at all; redaction reduces exposure but does not override a term you agreed to.',
      },
      {
        question: 'Is it safe to run client invoices through an online tool?',
        answer:
          'Uploading a client\'s commercial terms to a third-party website is a disclosure in itself, and depending on your contract or your obligations under data protection law it may be one you were not entitled to make. Processing the file on your own machine avoids the question entirely, which is why this tool has no upload step and no server behind it.',
      },
      {
        question: 'Will the covered figures survive in the exported file?',
        answer:
          'No. Drawing a rectangle in a PDF viewer leaves the numbers underneath it, selectable by anyone. Here each page is flattened to an image with the boxes painted into the pixels, and the exported document is assembled from those images alone. The app re-opens the result and reports zero selectable characters, zero fonts and zero annotations before you share it.',
      },
    ],
  },
]

export const LANDINGS_BY_SLUG = Object.fromEntries(LANDINGS.map((l) => [l.slug, l]))
