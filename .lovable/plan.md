
User provided exact patch instructions. Plan is just to execute them. Need to view Scan.tsx to map current names to new ones since I don't have its current contents in context.

Quick scope:
- `src/pages/Scan.tsx`: jargon replacements, hint block, manual entry validation + autofocus + numeric inputMode, FAQ → visible "Need help?" button, camera-fail toast with manual-entry action, demo brands rename, HTTPS copy
- `src/pages/UnknownProduct.tsx`: lead with two CTAs (Search by brand / Scan another), wrap existing Add Product card in Collapsible behind "Submit this product", add moderation copy

UnknownProduct already has Collapsible available (component exists) and already has the photo + moderation logic. Just reordering + collapsing.

No DB, no edge functions. Pure UI/copy. ~2 file edits.
