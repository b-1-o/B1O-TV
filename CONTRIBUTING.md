# Contributing to B1O TV

Thanks for helping improve B1O TV. Contributions should keep the app lightweight, accessible with a TV remote, privacy-conscious, and compatible with Samsung Tizen.

## Before opening a pull request

1. Open an issue for large changes or new service integrations.
2. Keep UI text and all user-facing documentation in English.
3. Do not add provider keys, device tokens, service credentials, certificate files, or private server URLs.
4. Prefer native browser features and tested Tizen APIs over heavy background effects.
5. Keep every interactive action reachable with the remote and provide visible focus feedback.

## Checks

Run from the repository root:

```sh
npm install
npm run typecheck
npm run typecheck:assistant
npm run lint
npm test
npm run build
```

For remote-navigation changes, include the key sequence tested and the target TV model/firmware. Automated tests are necessary but do not replace a physical-remote test.

## Reporting a security issue

Do not publish live API keys, Worker tokens, signing certificates, or exploitable details together with credentials. Revoke exposed service credentials and report the issue privately through an appropriate GitHub security channel when available.
