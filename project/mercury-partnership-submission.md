# Mercury Partnership Submission Packet

Last updated: 2026-03-28
Owner: Time2Pay
Primary contact: support@time2pay.app

## Required Items for Mercury

### 1) Redirect URI for production client
- `https://time2pay.app/profile`

### 2) Redirect URIs for development/testing
- `http://localhost:3000/profile`
- `http://localhost:8081/profile`
- `https://lucid-lewin.108-175-12-95.plesk.page/profile`

### 3) Public links for legal pages and logo
- Terms of Service: `https://time2pay.app/terms`
- Privacy Policy: `https://time2pay.app/privacy`
- Logo: `https://time2pay.app/images/time2payLogo.png`

### 4) GPG public key
- Public key armored block: `project/keys/mercury-time2pay-public.asc`
- Fingerprint: `A07E 9B4A 0390 860B E6CE 42AA 5B28 4736 A41B 58C3`
- UID: `Time2Pay Mercury Partnership <support@time2pay.app>`
- Key type: `ed25519` (sign/certify/auth) + `cv25519` encryption subkey
- Yes: send the entire armored public key block below to Mercury.

#### Armored Public Key (copy/paste)

```asc
-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEacgynxYJKwYBBAHaRw8BAQdAL71g215UECBbJJZqCDz6QnNte3duB3MFw5FH
Oc7HpvW0M1RpbWUyUGF5IE1lcmN1cnkgUGFydG5lcnNoaXAgPHN1cHBvcnRAdGlt
ZTJwYXkuYXBwPoi1BBMWCgBdFiEEoH6bSgOQhgvmzkKqWyhHNqQbWMMFAmnIMp8b
FIAAAAAABAAObWFudTIsMi41KzEuMTIsMiwxAhsjBQkB4TOABQsJCAcCAiICBhUK
CQgLAgQWAgMBAh4HAheAAAoJEFsoRzakG1jD3ucBAPg+9OEthmM50bVNeKF3ZF6c
AnxUjKDvq5ASKrBsQ9LkAP4/rtKq5G46rt6G1r+X7GjnlEemlz5rE/U3+WgFcfn+
Cbg4BGnIMp8SCisGAQQBl1UBBQEBB0ATbmsxm3iWakyWMWR2wIMZnDv/KS5V5xru
SK1YRkMlLAMBCAeImgQYFgoAQhYhBKB+m0oDkIYL5s5CqlsoRzakG1jDBQJpyDKf
GxSAAAAAAAQADm1hbnUyLDIuNSsxLjEyLDIsMQIbDAUJAeEzgAAKCRBbKEc2pBtY
w/1cAP9Ogwv/2dybBlCYXbXOIMZ/YI5ThZaRez8LkoLpSU4eJQD/WA47vk5CpHij
ONIqAwHwl3Y6NK11TRtZav3h6OGdfg0=
=Nr58
-----END PGP PUBLIC KEY BLOCK-----
```

## Developer Area (everything above can be submitted to Mercury in an e-mail)

## Verification Checklist
- [ ] All redirect URIs are registered exactly as listed with provider settings.
- [ ] `https://time2pay.app/terms` returns HTTP 200 publicly.
- [ ] `https://time2pay.app/privacy` returns HTTP 200 publicly.
- [ ] Logo URL is reachable with no authentication.
- [ ] Public key imports successfully into a clean keyring.
- [ ] Fingerprint in this packet matches local keyring output.

## Mobile + Google Play Alignment Notes
- The same Terms, Privacy, and logo URLs should be reused for Play Console listings.
- If native OAuth deep links are added later, append them to this file without removing current web redirects.
- Keep legal page URLs stable to avoid repeated partner/store review cycles.
