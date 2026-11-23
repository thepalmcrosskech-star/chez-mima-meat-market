# Project Engineering Rules

- Use row-level access rules and narrowly granted `SECURITY DEFINER` RPCs for order and role-sensitive workflows, so client-side writes cannot bypass server validation.
- Enforce IP bans from gateway request headers at both order RPC entry and every order insert; fail closed without an IP and compare all forwarded IP candidates as inet so forged prefixes and IPv6 formatting cannot bypass bans, while admin unban remains independent of order guards.
- Keep app-shell service-worker registration in one production-only wrapper that excludes Lovable previews and uses network-first page navigation, so offline caching cannot strand visitors on stale app screens.
- Resolve access from protected user_roles; profile roles are compatibility mirrors changed only by validated RPCs, so editing a profile cannot grant privileges.
- Bootstrap the first administrator only through a locked, single-use reservation and a confirmed matching auth email; never grant the first signup administrator access.
- Keep catalogue media in CDN asset pointers and attach by existing product ID; supplementary gallery views do not create sellable variants or change order data.
- Use ProductPhoto for product detail and enlarged media; decode the displayed image before revealing it and preserve portrait framing so partial downloads and square cropping cannot hide the product.
- Derive administrator push content and recipients from a stored order; reserve custom delivery messages for authenticated internal calls, and prohibit anonymous IP probing to protect customer privacy.
- Startup shows only the static boot screen in index.html (no second React splash); its light logo is preloaded and revealed only after decode, so startup never shows a partial logo or adds delay.
- Centralize visual identity in semantic HSL tokens, shared controls and a project-owned logo pointer; presentation changes must not alter data or business workflows.
- Wrap customer page headers in CustomerHeader so the shared origin promise is integrated into the same sticky banner without duplicate badges; keep staff headers independent.
- Keep catalogue browsing public; require a session to add to cart and to check out, returning customers only to same-origin non-staff paths after login, so role destinations stay protected.- Group catalogue variants (e.g. drink flavours) through the nullable products.family field; each variant stays its own product so stock, price and availability are managed individually.
- Keep the custom domain connected through Cloudflare proxy mode (CNAME verification, proxied record) because the direct A-record IP is unreachable from Morocco; never re-point it to a direct A record or a different IP.
- Ship the Android store app as a Trusted Web Activity of the primary custom domain (the lovable.app host redirects there, which breaks verification), verified by public/.well-known/assetlinks.json; keep both upload and Play signing fingerprints there so the app opens without a browser bar.
- Catalogue cards and lists show photos through productThumbnail (pre-generated lighter CDN copies, same framing); product detail keeps the original. Regenerate thumbnails when adding product photos; unknown URLs fall back to the original.
