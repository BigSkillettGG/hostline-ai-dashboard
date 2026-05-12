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

The voice service now includes the first OpenTable adapter. It stays dormant until the approved OpenTable sandbox/API credentials and the exact reservations endpoint are configured. When configured, `create_reservation_request` will try OpenTable first; if OpenTable confirms, the Supabase reservation row is saved as `provider = opentable`, `status = confirmed`, and `manual_request = false`. If OpenTable is unavailable or returns an error, Vera falls back to the staff-confirmed request flow and does not guarantee the table.

## OpenTable Production Milestones

1. Request OpenTable API sandbox and partner access.
2. Add `OPENTABLE_CLIENT_ID`, `OPENTABLE_CLIENT_SECRET`, `OPENTABLE_RESTAURANT_ID`, and `OPENTABLE_RESERVATIONS_URL`.
3. Add `OPENTABLE_AUTH_URL` if OpenTable's issued sandbox uses OAuth client credentials.
4. Test booking creation against the OpenTable sandbox endpoint.
5. Implement a separate availability lookup endpoint once the sandbox docs expose the exact availability URL.
6. Add dashboard conflict handling for unavailable times and alternate time suggestions.

## Render Variables

```txt
OPENTABLE_CLIENT_ID=<from OpenTable sandbox>
OPENTABLE_CLIENT_SECRET=<from OpenTable sandbox>
OPENTABLE_RESTAURANT_ID=<OpenTable restaurant/venue id>
OPENTABLE_RESERVATIONS_URL=<exact sandbox booking endpoint from OpenTable docs>
OPENTABLE_AUTH_URL=<optional OAuth token URL from OpenTable docs>
```

## Sources

- OpenTable API partner page: https://www.opentable.com/restaurant-solutions/api-partners/
- OpenTable API and partner FAQ: https://www.opentable.com/restaurant-solutions/api-partners/faqs/
