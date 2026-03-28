# Mercury GPG Workflow

Use a dedicated keypair for Mercury partnership communication.
Do not commit private key material.

## 1) Generate dedicated keypair (Windows PowerShell)

Run:

```powershell
./scripts/generate-mercury-gpg.ps1 -Name "Time2Pay Mercury Partnership" -Email "support@time2pay.app"
```

If your operational email differs, pass the actual mailbox used for compliance/security communication.

## 2) Output artifacts

Script output path:
- `project/keys/mercury-time2pay-public.asc`
- `project/keys/mercury-time2pay-public-fingerprint.txt`

Secure local output path (private material, do not commit):
- `%LOCALAPPDATA%/Time2Pay/mercury-gpg/mercury-time2pay-public-private.asc`
- `%LOCALAPPDATA%/Time2Pay/mercury-gpg/mercury-time2pay-public-revocation.rev`
- `%LOCALAPPDATA%/Time2Pay/mercury-gpg/mercury-time2pay-public-passphrase.txt`

Do not create or store private key exports in this repository.

Send to Mercury:
- The fingerprint and armored public key block (from `project/mercury-partnership-submission.md`).
Do not send:
- Private key backup, revocation file, or passphrase.

## 3) Validate

```powershell
gpg --import project/keys/mercury-time2pay-public.asc
gpg --show-keys --fingerprint project/keys/mercury-time2pay-public.asc
```

## 4) Update submission packet

Update `project/mercury-partnership-submission.md` with the final fingerprint value.

## 5) Rotation guidance

- Rotate the key if compromise is suspected.
- Generate and store revocation material offline.
- Keep lifecycle notes in your internal compliance log.
