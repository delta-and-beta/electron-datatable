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
