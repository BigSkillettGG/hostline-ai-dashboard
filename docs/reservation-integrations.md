# Reservation Integrations

## Recommended First Path

OpenTable is the first direct reservation integration target.

Reasons:
- OpenTable has an official API partner page, API sandbox, and developer documentation path.
- OpenTable specifically names Booking API, Sync API, CRM API, and Directory API reservation links.
- OpenTable's FAQ says restaurants and approved third parties can consume APIs directly, with restaurant account-management involvement.

Resy stays on the roadmap, but it should come after OpenTable unless a pilot restaurant gives us direct Resy partner credentials. Public Resy materials describe ResyOS reservation management features, but the public API onboarding path is less explicit than OpenTable's.

## Current Product Behavior

Until a booking provider is fully connected, Vera should not guarantee a table.

For a reservation call, Vera should:
1. Collect date, time, party size, guest name, phone number, and notes.
2. Save a staff-confirmed reservation request.
3. Tell the caller staff will confirm shortly.
4. Offer to text the request summary when texting is enabled.

## OpenTable Production Milestones

1. Request OpenTable API sandbox and partner access.
2. Add `OPENTABLE_CLIENT_ID`, `OPENTABLE_CLIENT_SECRET`, and `OPENTABLE_RESTAURANT_ID`.
3. Implement availability lookup.
4. Implement booking creation.
5. Persist `provider = opentable` and `provider_reservation_id` on confirmed reservation rows.
6. Add dashboard conflict handling for unavailable times and alternate time suggestions.

## Sources

- OpenTable API partner page: https://www.opentable.com/restaurant-solutions/api-partners/
- OpenTable API and partner FAQ: https://www.opentable.com/restaurant-solutions/api-partners/faqs/
