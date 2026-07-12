# Desktop Distribution

Agent Explorer uses two GitHub Actions workflows:

- `Desktop CI` validates the frontend and builds unsigned desktop artifacts on pull requests, pushes to `main`, and manual runs.
- `Desktop Release` creates one draft release, uploads every platform bundle to it, and publishes the release only after all platform jobs succeed. It runs when a `vX.Y.Z` tag is pushed, or when an existing tag is supplied manually. It serializes same-tag runs and checks all macOS/updater signing secrets before creating a draft release.

## Versioning

The version must match in:

- `package.json`
- `src-tauri/Cargo.toml`
- `src-tauri/tauri.conf.json`

Run `pnpm version:check` locally. Release tags must use the same version with a `v` prefix, for example `v0.1.0`.

## Build outputs

| Platform | Architectures | Bundles |
|----------|---------------|---------|
| macOS | Apple Silicon, Intel | `.app`, `.dmg` |
| Windows | x64 | NSIS `.exe` |
| Linux | x64 | `.deb`, `.AppImage` |

CI builds are unsigned and are retained as workflow artifacts. Tag builds are attached to a GitHub Release.

## macOS signing and notarization

Unsigned macOS builds work for local development but are not suitable for public distribution. Configure these repository secrets before publishing a trusted macOS release:

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID Application `.p12` certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` certificate |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application certificate identity |
| `APPLE_ID` | Apple account used for notarization |
| `APPLE_PASSWORD` | App-specific password for the Apple account |
| `APPLE_TEAM_ID` | Apple Developer Team ID |

The release workflow passes these values using the environment names expected by the Tauri CLI. Do not store certificate files or credentials in the repository.

## Updater signing

Every in-app update is cryptographically signed. Signature verification cannot be disabled.

| Secret | Purpose |
|--------|---------|
| `TAURI_SIGNING_PRIVATE_KEY` | Content of the Tauri updater private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Private-key password; leave this secret unset when the key was generated without one |

The matching public key is embedded in `src-tauri/tauri.conf.json`. Keep at least two secure backups of the private key. Losing it prevents existing installations from accepting future updates. Never commit the private key.

Normal local and CI builds do not create updater bundles. The release workflow merges `src-tauri/tauri.release.conf.json`, enables updater artifacts, signs them, uploads the `.sig` files, and generates `latest.json` for the static GitHub Releases endpoint. The app checks that endpoint quietly after startup, but downloading, installing, and restarting always require an explicit user action.

## Windows signing

The current workflow produces an unsigned NSIS installer. Windows code signing requires a certificate provider decision because the setup differs for a local PFX certificate, Azure Trusted Signing, and hardware-backed certificates. Add provider-specific signing only after choosing where the certificate will be stored. Do not commit a PFX file.

## Publishing

1. Update all three application versions.
2. Run `pnpm version:check`, `pnpm lint`, `pnpm test`, and `pnpm desktop:build`.
3. Commit the release changes.
4. Create and push the matching tag, such as `v0.1.0`.
5. Confirm every platform job succeeds before publishing or announcing the release.
