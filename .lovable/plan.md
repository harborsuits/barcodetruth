
User wants a real end-to-end audit, not code-existence verification. They listed a specific hard-test checklist. I should run it for real using the browser, then report concrete pass/fail with evidence.

Plan:
1. Use browser to open /scan in the preview
2. Inspect manual entry validation against bad inputs (7 digits, 14 digits, letters, spaces/dashes, paste with formatting) — confirm it BLOCKS, not just decorates
3. Test camera-deny path — does toast fire, does manual mode open, does input autofocus
4. Click "Try a demo scan" — trace whether it hits the real lookup pipeline (network panel: does it call `get-product-by-barcode` / `scan-product` like a real scan, or shortcut to a result?)
5. Submit a real seeded barcode (e.g. 049000000009) — measure perceived latency, check for blank/loading states, confirm result renders
6. Submit an unknown barcode — confirm it routes to /unknown/:barcode without dead-end
7. Read code paths in parallel where browser can't tell the full story:
   - `Scan.tsx` manual submit handler — confirm validation is a hard gate
   - Demo scan button handler — confirm it goes through real lookup
   - Camera error catch — confirm toast + state change + focus
   - Verify "we don't store your photos" claim by checking if any image upload/log happens during camera scan (grep for image upload in scanner code)
8. Offline test — flip network in browser devtools isn't available; instead verify the code has proper error UI for fetch failures

Deliverable: a brutal pass/fail table with evidence (screenshots, code snippets, network calls), no theater. If anything fails, fix it in the same loop and re-verify.

Files I'll need to read: `src/pages/Scan.tsx` (full), and whatever the demo-scan handler calls. Probably also the camera component.

This is a verification + likely-fix task, not a pure design task. ~30 min of real work, may produce 1–3 small follow-up patches if the audit finds gaps.
