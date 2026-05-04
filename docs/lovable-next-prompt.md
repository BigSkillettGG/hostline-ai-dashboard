# Lovable Follow-Up Prompt

Use this prompt in Lovable when you want it to continue from the current dashboard without changing the product direction.

```text
Continue the HostLine AI dashboard as an operational SaaS app for restaurants. Keep the app as a dashboard, not a landing page.

Important product rules:
- HostLine AI is restaurant-type agnostic.
- Each location configures whether the AI answers immediately, after X rings, only after hours, or only when manually enabled.
- Order taking can be enabled or disabled.
- Reservation handling can be disabled, integrated with a provider, or handled as a manual staff-confirmed request.
- MVP payment mode is pay at pickup only.
- Order routing must support POS integration, kitchen tablet, kitchen printer, and staff review queue.
- Manual reservation requests must be clearly marked as not confirmed until staff confirms them.
- The AI should lightly disclose itself as a virtual host by default.
- Keep the UI dense, operational, and premium. Avoid marketing-page sections.

Use the existing docs as the source of truth:
- docs/mvp-spec.md
- docs/architecture.md
- docs/supabase-schema.sql

Improve the dashboard by adding a first-run setup flow for a new restaurant location. The setup flow should collect:
1. Restaurant profile.
2. Phone handling mode.
3. Menu upload or manual menu setup.
4. Knowledge base facts.
5. Order-taking settings.
6. Reservation settings.
7. Integrations.
8. Voice identity and greeting.
9. Launch checklist.

The setup flow should use the same shadcn/ui style, React Router structure, and mock data approach already in the repo. Do not add real external API calls yet.
```
