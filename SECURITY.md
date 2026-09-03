# Security Policy

## Supported versions

ReadLens is pre-release software. Security fixes currently target the latest revision on the default branch.

## Reporting a vulnerability

Use GitHub's private security advisory feature when the repository is public. Do not open a public issue for SSRF, private-network access, command execution, cache poisoning, or dependency vulnerabilities.

Include reproduction steps, affected URLs or address classes, expected behavior, and observed behavior. Use placeholders instead of real secrets or internal addresses.

## Security model

ReadLens rejects non-HTTP protocols and private-network destinations by default. Redirects are validated before they are followed, and Lightpanda receives its private-network blocking option. `--allow-private` intentionally disables this boundary and should not be enabled for untrusted agent input.

