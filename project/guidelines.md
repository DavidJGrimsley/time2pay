# Time2Pay Guidelines

- Keep Expo Router route files thin; move business logic into `src/features` and `src/services`.
- Run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run doctor` before pushing.
- Treat `EXPO_PUBLIC_*` as public data only; never place secrets in public env vars.
- Keep deployment workflows gated by CI quality checks.
