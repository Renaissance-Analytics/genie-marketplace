# Genie Marketplace

The **official plugin marketplace** for [Genie](https://github.com/Renaissance-Analytics/genie) — the **Agentic Development Environment (ADE)**.

Every plugin here is curated and **Ed25519-signed** with the Genie publisher key. Genie verifies each signature against its bundled trust root at install time, so a plugin from this marketplace is **trusted by construction** — untrusted or tampered code never loads.

## Layout

```
genie-marketplace.json     the marketplace index — lists the available plugins
plugins/<name>/
  ├── genie-plugin.json    the plugin manifest (declares tools/editors + capabilities + signature)
  └── …                    the plugin's code / editor mapping
```

## Signing (CI only — the key never leaves GitHub)

Plugins are signed **in CI on release** using the `GENIE_PLUGIN_SIGNING_KEY` organization secret (the Ed25519 private key). Contributors just open a PR and push — the release workflow signs the manifest with the org key; **nobody handles the private key locally.**

Trusted publisher keyId: `ed25519-bHc2Rt62EgjmpE5Fd7-QsJeNi36BsAwckJ4bEyx4BCE`

## Contributing a plugin

1. Add `plugins/<your-plugin>/` with a `genie-plugin.json` manifest + code.
2. Open a PR. CI validates the manifest + runs checks.
3. On merge/release, CI signs it with the org key and updates the marketplace index.
