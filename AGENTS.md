# Project Engineering Rules

- Use row-level access rules and narrowly granted `SECURITY DEFINER` RPCs for order and role-sensitive workflows, so client-side writes cannot bypass server validation.
- Keep app-shell service-worker registration in one production-only wrapper that excludes Lovable previews and uses network-first page navigation, so offline caching cannot strand visitors on stale app screens.
- Resolve access from protected user_roles; profile roles are compatibility mirrors changed only by validated RPCs, so editing a profile cannot grant privileges.
- Bootstrap the first administrator only through a locked, single-use reservation and a confirmed matching auth email; never grant the first signup administrator access.
- Keep catalogue media in CDN asset pointers and attach by existing product ID; supplementary gallery views do not create sellable variants or change order data.
- Derive administrator push content and recipients from a stored order; reserve custom delivery messages for authenticated internal calls, and prohibit anonymous IP probing to protect customer privacy.
- Bound splash image loading and keep its completion callback stable so stalled media or parent renders cannot indefinitely hide the application.
- Centralize visual identity in semantic HSL tokens, shared controls and a project-owned logo pointer; presentation changes must not alter data or business workflows.
- Keep catalogue browsing public; require a session to add to cart and to check out, returning customers only to same-origin non-staff paths after login, so role destinations stay protected.