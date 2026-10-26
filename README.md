# CodeRifts GitHub Action

[![npm version](https://img.shields.io/npm/v/coderifts?color=blue&label=coderifts)](https://www.npmjs.com/package/coderifts)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

Official GitHub Action for [CodeRifts](https://coderifts.com) — API governance on every pull request. Detects breaking changes in OpenAPI schemas, scores risk, enforces policies, and posts a governance report as a PR comment.

A GitHub Action. For other CI systems, use the `coderifts` CLI directly.

## Quick Start

```yaml
- uses: coderifts/action@v1
  with:
    api-key: ${{ secrets.CODERIFTS_API_KEY }}
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | Your CodeRifts API key |
| `base-branch` | No | `main` | Branch to compare against |
| `fail-on-breaking` | No | `true` | Fail the workflow on breaking changes (`coderifts diff --ci`: exit 1 on a break; exit 2, "could not decide", always fails the step) |
| `spec-path` | No | `api/openapi.yaml` | Contract file to compare, relative to the repository root; its version on `origin/<base-branch>` is the base |
| `config-file` | No | `.coderifts.yml` | Path to governance policy file |

## What this action binds, and what it does not prove

It runs `coderifts diff <spec on origin/<base-branch>> <spec in the checkout>` (with `--ci` when
`fail-on-breaking` is true) — the CLI's local analysis, on the runner. It binds **no receipt field**: it
requests no receipt, verifies no signature, and does not call `preflight_change_set` or `authorize`.

It does not prove:
- that a change is authorized — a passing step means the local analysis found no break, not that a
  signed CodeRifts decision allowed it (the signed path is the `CodeRifts / contract-gate` check);
- that the comparison covers more than `spec-path` — another contract file in the repository is not read;
- that the base is what it should be — the base is the file on `origin/<base-branch>` at the time of the
  run; a contract absent there is reported as new and the step passes.

## Setup

1. Get a free API key at [app.coderifts.com/api/signup](https://app.coderifts.com/api/signup)
2. Add `CODERIFTS_API_KEY` as a repository secret in **Settings → Secrets and variables → Actions**
3. Add the workflow file above to `.github/workflows/api-governance.yml`
4. Every pull request that modifies an OpenAPI spec will now run a CodeRifts governance check

## Full Example

```yaml
name: API Governance
on:
  pull_request:
    paths:
      - '**/*.yaml'
      - '**/*.yml'
      - '**/*.json'

jobs:
  api-governance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: coderifts/action@v1
        with:
          api-key: ${{ secrets.CODERIFTS_API_KEY }}
          fail-on-breaking: true
```

## What You Get

Every pull request that modifies an OpenAPI schema receives a governance report with:

- **Risk Score (0–100)** — Revenue impact, blast radius, compatibility, and security scored across 4 dimensions
- **Policy Violations** — Breaking budgets, freeze windows, and approval requirements checked against `.coderifts.yml`
- **Security Analysis** — Auth scheme changes detected with 5 severity levels and OAuth scope tracking
- **Migration Estimates** — Engineering effort and downstream service impact calculated per breaking change
- **Change Intent** — Every change classified as structural, behavioral, security, or performance
- **Confidence Score** — How certain CodeRifts is about each detected change

## When to Use This vs. the GitHub App

| | GitHub App | GitHub Action |
|---|---|---|
| Setup | One-click install | Workflow file + API key |
| PR Comments | Automatic | Via job summary |
| Zero Config | Yes | Requires workflow file |
| Best For | Teams wanting zero setup | Teams wanting full CI control |

If you want zero-config PR comments with no workflow file, [install the GitHub App](https://github.com/apps/coderifts) instead.

## Works Everywhere You Code

This is the GitHub Actions integration. CodeRifts also works with:

| Platform | How |
|---|---|
| GitHub App | Zero-config, one-click install |
| GitHub Actions | `uses: coderifts/action@v1` (this repo) |
| GitLab CI | [CI/CD Catalog component](https://coderifts.com/integrations/gitlab/) |
| Bitbucket Pipelines | [Docker pipe](https://coderifts.com/integrations/bitbucket/) |
| REST API | Bearer token, any CI/CD system |
| CLI | `npx coderifts diff` |
| Web UI | [app.coderifts.com/try](https://app.coderifts.com/try) |

Full integration docs: [coderifts.com/integrations/](https://coderifts.com/integrations/)

## Links

- **Website:** [coderifts.com](https://coderifts.com)
- **GitHub Actions docs:** [coderifts.com/integrations/github-actions/](https://coderifts.com/integrations/github-actions/)
- **Install GitHub App:** [github.com/apps/coderifts](https://github.com/apps/coderifts)
- **All integrations:** [coderifts.com/integrations/](https://coderifts.com/integrations/)
- **CLI on npm:** [npmjs.com/package/coderifts](https://www.npmjs.com/package/coderifts)

## License

This GitHub Action wrapper is open-source under the [MIT License](LICENSE). It calls the CodeRifts API, which is a proprietary service governed by the [Terms of Service](https://coderifts.com/terms/).

The Action itself contains no proprietary logic — it is a thin wrapper that sends your OpenAPI spec to the CodeRifts API and formats the response. You are free to fork, modify, and redistribute the Action code.
