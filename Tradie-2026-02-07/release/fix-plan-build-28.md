# Fix plan: build 28

From Paul's TestFlight findings on build 27 (see `testflight-feedback.md`). Everything is fixed in one pass, checked, and only then built once.

## 1. Stop the crashes (items 7, 9)

- [x] Leaving Add Job (Back, Cancel or Save) crashed: guarded the recorder clean-up. *In code, not built.*
- [x] Checked every other screen that uses phone features: only Add Job had the problem.

## 2. Don't record things that didn't happen (item 13)

- [x] After the share sheet closes on an invoice or quote, ask **"Did you send it?" → Yes, mark as sent / Not yet**. Only "Yes" marks it sent and starts the due date. *In code.*

## 3. First run and adding a job (items 2, 3, 15, 16, 4, 5)

- [x] **Home header:** greeting on its own, full-width cyan **New job** button below it. *In code.*
- [x] **First-run Home:** "Add your first job" with one **Add a job** button (no voice), plus the "Set up your business" checklist: business details, how customers pay you, insurance and licences. *Partly in code.*
- [x] **Add Job opens on the typing form.** *In code.* (The "Say it instead" option is removed again by section 3a.)
- [x] ~~After voice ("Check the job")~~: no longer needed in 1.6 (voice off, section 3a).
- [x] ~~Voice accuracy~~: kept in code for later; no server redeploy needed for 1.6.

## 3a. Voice off for 1.6 (Paul's decision)

Voice could irritate people when it gets things wrong. Typing is the main way in, and dictation comes free from the iPhone keyboard.

- [x] One on/off switch (`VOICE_ENABLED = false`) hides "Say it" (Home), "Say it instead" (Add Job) and the voice screen. The code stays for later.
- [x] Welcome: remove "Add a job by voice", leaving four benefits.
- [x] Paywall and limits: remove the "voice jobs" Pro bullet, the 3 free voice jobs and the voice limit sheet.
- [x] Sign-in wording (Welcome, Account): "keeps Pro on a new phone and turns on drive times".
- [x] Microphone wording made neutral instead of removed: Apple's upload check rejects apps whose code can record without an explanation (ITMS-90683). With voice off the app never asks.
- [x] Keyboard-dictation hint under job **Notes** and the **To-do** box: "Tip: tap 🎤 on the keyboard to speak it."
- [x] App Store listing (UK and US): remove voice from the description, promo text and What's New.
- [x] App Review notes: remove the voice mentions.
- [x] Screenshot 1 (Welcome), UK and US: re-shot with four benefits and swapped into Paul's design (all upload sizes). All 9 US designed screenshots rebuilt on the UK frames (the earlier US set had lost the Dynamic Island and bezel).
- [ ] Privacy policy: tidy the voice section (optional).

## 4. Edit what you've already saved (item 6)

- [x] **Edit job:** an Edit option on the job title for job type, description and urgency. If it isn't invoiced, the labour price updates and materials and travel are kept.

## 5. Preview and edit invoices and quotes (item 12)

- [x] Add `react-native-webview` (approved by Paul).
- [x] **Preview screen:** the exact PDF full screen (scroll, zoom), with **Edit** and **Send**. For invoices and quotes.
- [x] **Edit invoice:** labour, materials, travel and description on any unpaid invoice; the preview updates. If it was already sent, prompt to send the corrected one.
- [x] The invoice sheet and the job screen get a **Preview** option.

## 6. Appearance (item 8)

- [x] Account → **Appearance: Automatic · Light · Dark**. Dark stays dark whatever the iPhone is set to.

## 7. Expense amount (item 10)

- [x] Size the big amount box from the real text width so it never clips or scrolls.

## 8. Clarity pass (item 14): agreed

- [x] Short confirmation after every action ("Job saved", "Marked as paid").
- [x] One-off tip on the Tax card: "This works out the tax on your profit. It doesn't change what customers pay." Shown once, dismissible.
- [x] Statuses that say the next step ("Quoted · waiting for Sarah to say yes").
- [x] Every empty list explains itself and offers the action.

## Checks before building

- [x] Typecheck, lint, all tests (UK tax, US tax, scheduling), expo-doctor.
- [x] Web walkthrough script as a brand-new user: Welcome → Home → type a job → save → edit job → quote preview → send ("Not yet", then "Yes") → book → done → invoice preview → edit invoice → send → mark paid → expense with a large amount → appearance switch. **19/19 passed, no page errors** (it caught items 19 and 20).
- [x] One native simulator check (Release build): Add Job opened and closed twice with no crash, Quote Preview (native PDF viewer) opens and closes, dark Appearance applied.
- [x] ~~Redeploy the server~~: not needed for 1.6 (voice is off).

## Build and retest

- [ ] Build 28 (EAS) → TestFlight.
- [ ] Paul retests: fresh install (delete the app first), every item above, then the parts not yet tested: paywall and restore, Chase, Suggest times, Money and tax, export, Account.
- [ ] New findings go into `testflight-feedback.md`, using the same process.

## Later (not in 1.6)

- **Voice as dictation, Vulcan-style:** a mic button on job Notes and To-do that types what you say into that one box, using Apple's on-device speech recognition (no server, works offline). Why: Vulcan's voice works because it only dictates into one visible, editable field; Tradie's split one sentence into many fields through a second AI step, so mistakes landed silently (e.g. "Li King" as a customer name).
- **Voice job entry**, only if dictation proves popular: reuse the server work already in code (trade-word hint, stricter name rules) and test against 10 real job notes before it ships.

