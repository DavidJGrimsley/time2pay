# @mrdj/mercury

Incubating Mercury SDK for the Time2Pay workspace.

This package is intentionally server-first. The Expo app consumes it behind `/api/mercury` while the API surface stabilizes for extraction into a standalone repository later.

## Contract Tests (Mercury test environment)

Run contract tests against Mercury's test environment with:

```bash
npm run test:mercury:contract
```

Required variables:

- `MERCURY_CONTRACT_RUN=true`
- `MERCURY_SANDBOX_API_KEY=...`

Optional variables:

- `MERCURY_SANDBOX_BASE_URL` (defaults to Mercury test URL)
- `MERCURY_CONTRACT_AR_ENABLED=true` to enable customer/invoice create checks
- `MERCURY_CONTRACT_DESTINATION_ACCOUNT_ID` if account auto-selection is not desired
- `MERCURY_CONTRACT_TRANSFER_PAYLOAD_JSON` for transfer create validation
- `MERCURY_CONTRACT_SEND_MONEY_ACCOUNT_ID` and `MERCURY_CONTRACT_SEND_MONEY_PAYLOAD_JSON` for send-money validation
