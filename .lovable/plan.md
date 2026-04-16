
User picked: Validity first + Soft gate with photo proof. I have enough context from the audit to plan directly. No need to re-explore.

Validity-first scope (5 trust killers from audit):
1. Accent search ("Nestle" ≠ "Nestlé") — needs `unaccent` on both sides in `search_catalog` RPC + `search-brands` edge function
2. Quick-tap NESTLÉ → unknown barcode — fix hardcoded test barcodes
3. "Drake mixtape" leak in identity card — extend entity-mismatch keyword scan + flag corrupted rows
4. Evidence linkage weak — "4 labor violations" headline ties to merger story. Need stricter category↔event matching in `ReasonProofList`
5. Category display mismatch — "160 records across 4 categories" but UI only shows "Power & Profit". Render all category counts.

Plus soft-gate Add Product: require photo upload, auto-publish with `community_submitted=true` flag, queue for review.

Keep it tight. ~6 file touches + 1 migration + 1 storage bucket.
