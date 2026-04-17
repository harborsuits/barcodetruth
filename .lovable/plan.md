
The user has given thorough feedback on barcodetruth.com. Let me check what's already done vs what's still needed.

Looking at current state:
- Hero ✅ (strong line, animation)
- ExampleStrip ✅ (3 sample verdicts — proof)
- HowItWorksThreeStep ✅
- SampleVerdict ✅ (with confidence label)
- AlternativesPreview ✅
- TrustStrip ✅
- InstallCTA ✅
- PublicFAQ ✅

So most of the feedback (#1 proof, #2 trust signals) is **already shipped** on the public homepage. The user may not realize this because they're logged in and seeing the private `Home` page (which is just HeroSection + HowItWorks + bottom nav with Scan/Search/Settings/Admin).

The feedback items #3 (nav cleanup) and #4 (search friction) actually apply to the **logged-in app**, not the public site. That's where Admin is exposed in the bottom nav, and where Search shows "Loading search…".

Real gaps to address:

**Gap A — Admin in primary nav (private Home)**
Already gated by `useIsAdmin`, but still appears alongside consumer items. Move it out of the primary 3-icon strip — keep it accessible but visually de-emphasized (e.g., small icon in header, or only inside Settings).

**Gap B — Search loading + dead-end**
"Loading search…" feels slow → replace with skeleton + suggested/popular brands. When a product isn't indexed → offer "Request indexing" / "Submit this product" CTA instead of dead-end.

**Gap C — Trust links visibility on private Home**
Logged-in users land on `Home.tsx` which has HeroSection + HowItWorks but no link to /how-scores-work or /why-trust-us. Add a small "Trust & methodology" footer link row.

**Gap D — Public homepage trust link prominence**
ExampleStrip and SampleVerdict don't link to /how-scores-work. Add inline links so curious users can drill in.

I should ask one clarifying question because the user's feedback mixes public + private surfaces, and I want to confirm priority before touching the in-app nav.

Actually — let me just present a focused plan. The user is clearly action-oriented and the gaps are clear.

Plan scope: keep it tight. 4 changes.
