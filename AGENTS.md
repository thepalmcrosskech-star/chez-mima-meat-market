# Project Engineering Rules

- Use row-level access rules and narrowly granted `SECURITY DEFINER` RPCs for order and role-sensitive workflows, so client-side writes cannot bypass server validation.