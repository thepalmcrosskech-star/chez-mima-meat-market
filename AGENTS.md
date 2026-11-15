# Project Engineering Rules

- Use row-level access rules and narrowly granted `SECURITY DEFINER` RPCs for order and role-sensitive workflows, so client-side writes cannot bypass server validation.
- Keep app-shell service-worker registration in one production-only wrapper that excludes Lovable previews and uses network-first page navigation, so offline caching cannot strand visitors on stale app screens.