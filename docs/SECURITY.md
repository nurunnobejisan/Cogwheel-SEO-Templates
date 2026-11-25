# Security Policy

## Supported Versions

The following versions of Cogwheel SEO Studio are currently supported with security updates and patch releases:

| Version | Supported          |
| ------- | ------------------ |
| 2.7.x   | Yes                |
| 2.6.x   | Critical Fixes Only|
| < 2.6.0 | No                 |

---

## Reporting a Vulnerability

The Cogwheel engineering team takes the security of our hospitality search engine optimization tools, browser extensions, and automation scripts seriously.

If you believe you have discovered a vulnerability, security flaw, or credential exposure:

1. **Do not disclose the issue publicly** on GitHub Issues, pull requests, or social channels.
2. Please report the issue privately by emailing **security@cogwheelmarketing.com** with:
   - A clear description of the vulnerability.
   - Specific steps or proof-of-concept to reproduce the behavior.
   - Affected components (Chrome Extension Side Panel, Next.js API endpoints, Python CLI scripts, or OTA synchronization channels).
   - Your name and handle for attribution (optional).

### Response Timeline
- **Initial Response**: Within 48 hours acknowledging receipt of your report.
- **Triage & Assessment**: Within 5 business days with an assessment of severity.
- **Patch Release**: High and critical issues will be prioritized for an immediate patch release.

---

## Security Practices in Cogwheel SEO Studio

- **Zero Secrets in Code**: Automated CI scanning ensures that no API keys, private tokens, or credentials are committed to the repository.
- **Client-Side Isolation**: The Chrome Extension Manifest V3 operates in an isolated environment and never transmits property DOM content to third-party endpoints.
- **Over-The-Air (OTA) Integrity**: Rule updates fetched from GitHub are strictly validated against schema models before ingestion.
