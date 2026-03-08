# Time2Pay — Style & Build Notes

## Product Style
- Keep UX simple and fast for solo contractors.
- Prefer practical defaults over heavy configuration.
- Keep flows local-first and resilient offline.
- Make invoice and session data transparent and editable.

## Color System
- Primary: **Ash Grey** `#B5C2B7`
- Secondary: **Cinnamon Wood** `#BB7E5D`
- Black/Base Ink: **Carbon Black** `#1A1F16`
- White/Base Canvas: **Off White** `#F8F7F3`
- Use tokenized colors from `global.css` (`primary`, `secondary`, `background`, `card`, `heading`, `foreground`, `muted`, `border`).
- Avoid raw gray/hex utility classes in component markup unless there is a clear one-off exception.

## Engineering Style
- Prefer minimal dependencies.
- Keep business logic separated from UI.
- Use typed interfaces for data contracts.
- Use `expo-sqlite` for local persistence in Phase 1.
- Keep schema and naming close to future PostgreSQL compatibility.

## Architecture Guidelines
- UI layer should call service/repository functions, not raw SQL.
- Database helpers should be deterministic and easy to test.
- Use stable IDs and timestamp fields for future sync support.

## Documentation Style
- Keep docs task-oriented and concise.
- Track phase status in `project/todo.md`.
- Update `project/info.md` when roadmap or architecture shifts.
