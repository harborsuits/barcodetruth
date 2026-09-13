# Release 2 preview: reasons to switch

Built September 13, 2026, on the existing review branch. Production and its database are unchanged. No new charges, outreach, advertising integration or sponsored listings.

## Implemented

Home and scan results let shoppers choose ownership, ingredients/nutrition, recalls, company actions or local shopping. Selection persists through in-app navigation in memory; full reload clears it. Explicit next-shop saves store the product, broad reason and date on this device. Specific issues and ingredient terms are not saved to accounts, URLs, analytics or an advertising profile.

Approved catalog records expose available label text, provenance and catalog update date. Ingredient text search never establishes allergen absence. Only bounded sugar/salt/saturated-fat values from Open Food Facts are displayed, on the dataset's 100 g / 100 ml basis; missing values are not zero. The catalog date is not a label verification date.

Two reviewed Kraft Heinz examples distinguish PAC contributions from a stated hiring policy. Catalog reading links are filtered by topic words within at most 60 recent category records. They remain research leads, not proof of wrongdoing or ideological alignment. Religion is not used as a proxy for party politics.

Local discovery links a user-entered area to Google Maps and offers two sourced Warren, Maine examples: Beth's Farm Market and Spear Spring Farm. No GPS, distance ranking, inventory, ingredient advantage or political match is claimed. Brown's identity remains unresolved and was not added. Listings are unpaid; any future placement must be labeled Ad without changing evidence or creating a match.

The device checklist supports save, reload, reopen and remove without an account. It does not subscribe to alerts. Alternatives explain the required evidence for the selected reason. The existing English Breakfast comparison establishes different ownership only; health/political/recall-compatible substitutions are not implemented.

## Trust and release limits

Scan results require an approved database row. Navigation data and lookup hints cannot bypass publication review. Database failures propagate instead of becoming missing products. Focus, reconnect and remount do not repeat the mutation-capable lookup fallback. A new barcode or explicit retry can invoke it outside review mode.

The old verdict and score-derived allegations are removed from scan results. Other historical brand/score routes remain outside this slice. Incomplete brand research no longer blocks product checks. Existing candidate RPC still needs the earlier SQL repair deployed; collapsed research leads show lookup errors distinctly.

Recall status is explicitly unchecked. Official links and package-matching instructions are available; automatic recall matching and alerts are not. Inherited FDA firm-level matching and USDA adapter defects need separate repair. The existing paid-account, privacy, backup and production rollout gates remain.

## Source packet — reviewed September 13, 2026

- [Kraft Heinz 2024 political disclosure](https://www.kraftheinzcompany.com/pdf/2024_Political_Contributions.pdf), page 1, lists KraftHeinzPAC contributions of $15,000 to NRCC and $10,000 to DCCC. They are individual entries, not party totals or treasury donations. [FEC committee identity](https://www.fec.gov/data/committee/C00077701/).
- [Kraft Heinz EEO policy](https://www.kraftheinzcompany.com/eeo.html) names sexual orientation and gender identity/expression in hiring. The UI separates stated policy from implementation.
- [FEC SSF guidance](https://www.fec.gov/help-candidates-and-committees/taking-receipts-ssf/who-can-and-cant-contribute-to-ssf/) and [corporate spending guidance](https://www.fec.gov/help-candidates-and-committees/candidate-taking-receipts/support-corporations-labor-organizations/) distinguish federal company/PAC/personal spending; state coverage is not complete.
- [FDA consumer guidance](https://www.fda.gov/food/buy-store-serve-safe-food/food-recalls-what-you-need-know), [openFDA enforcement limits](https://open.fda.gov/apis/food/enforcement/), [FSIS recalls](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/understanding-fsis-food-recalls), [FSIS API](https://www.fsis.usda.gov/science-data/developer-resources/recall-api).
- [Open Food Facts API](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/) and [nutrition schema](https://openfoodfacts.github.io/documentation/docs/Product-Opener/schemas/schemas/product_nutrition/). Existing cached data is used; no new API was integrated.
- [Beth's Farm Market](https://www.bethsfarmmarket.com/), [Spear Spring Farm](https://www.spearspringfarm.com/), [Real Maine](https://realmaine.com/members/). These support business discovery, not today's inventory.
- [FTC native advertising guidance](https://www.ftc.gov/business-guidance/resources/native-advertising-guide-businesses) informs the proposed Ad label; advertising is inactive.

## Verification

10 Node tests pass: approved-product boundary, failure-versus-miss, preview network guard, auth returns, barcode normalization, ingredient unknowns, corrupt device notes and source-link safety. TypeScript, targeted ESLint and review build pass. Existing large-bundle warnings remain.

Browser checks: Kraft Heinz 000000100735 missing-label state; Pinwheels 0044000044268 recorded ingredients and palm-oil text match; source-labeled PAC evidence; topic controls; local area-link generation; checklist save/reload/reopen; and 390px layout. Actual phone camera, account lifecycle, alert delivery, verified political alternatives and advertiser demand remain unverified.

Next finite release: build a reviewed product/criterion dataset with actual qualifying substitutions, correct entity attribution and source dates. Expand beyond ownership based on explicit ingredients or company-action criteria. Measure useful alternatives and returning shoppers before projecting advertising income. No political or health selections should be used for ad targeting.
