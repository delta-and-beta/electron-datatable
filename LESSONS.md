# Lessons queue — consumer gaps waiting to be upstreamed

One line per gap, added the moment it is noticed (see docs/SOP.md step 1).
Delete the line when the feature ships.

- Decimals-aware money handling: currency columns assume 2dp conventions per
  column config; a currency registry (JPY 0dp etc.) driven by currency code
  would remove per-column `decimalPlaces` bookkeeping. (from company-app)
- Row expansion (master/detail rows) — needed before company-app's
  TransactionTable can migrate off its bespoke implementation. (from company-app)
- CI: GitHub Actions gates on push + npm publish on version tags with a
  granular automation token (removes the manual OTP publish step).
- StatusBadge dot indicator (`showDot`) — company-app keeps its own badge for
  the Confidence column only because of this.
- Record coloring: row-level color rules by field value (Airtable parity). (gap matrix 2026-07-11)
- Keyboard record navigation: arrow-key row focus + Enter opens the row. (gap matrix 2026-07-11)
- CSV export / print of the current view. (gap matrix 2026-07-11)
- Airtable sync adapter: fifth /sync adapter (Meta API schema, listRecords offset cursor, injected fetch client, snapshotConsistent:false). In build 2026-07-11.
- Source adapters must retain stable field IDs, descriptions, and raw options
  from schema discovery so consumers do not repeat the same Meta API request.
  (from company-app R8)
