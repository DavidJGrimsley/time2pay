---
name: NPM install blocked (403 / registry access)
about: Track environments where dependency installation fails due to registry/proxy policy
title: "npm install fails with 403 Forbidden when fetching packages"
labels: bug
assignees: ''
---

## Summary
`npm install` fails with `E403` / `403 Forbidden` while fetching packages from npm registry.

## Reproduction
1. Clone repo
2. Run `npm install`

## Actual behavior
Install fails with logs like:

```text
npm ERR! code E403
npm ERR! 403 Forbidden - GET https://registry.npmjs.org/@types%2freact
```

## Expected behavior
Dependencies install successfully.

## Environment
- OS:
- Node version (`node -v`):
- npm version (`npm -v`):
- Registry (`npm config get registry`):
- Proxy vars set (`env | grep -i -E 'npm|proxy'`):

## Diagnostics output
Paste output from:

```bash
./scripts/diagnose-npm-access.sh
```

## Notes
If this only reproduces in one network/profile, it likely indicates outbound registry access policy/proxy restrictions rather than a project code issue.
