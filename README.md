# CodeRifts GitHub Action

Detect breaking changes in OpenAPI schemas on every pull request — directly in your GitHub Actions workflow.

This Action uses the [CodeRifts CLI](https://www.npmjs.com/package/coderifts) to analyze OpenAPI spec changes and report breaking changes, risk scores, and policy violations.

## Usage

```yaml
name: API Governance

on:
  pull_request:

jobs:
  coderifts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: coderifts/action@v1
        with:
          api-key: ${{ secrets.CODERIFTS_API_KEY }}
          fail-on-breaking: true
```

## Inputs

| Input | Required | Default | Description |
|---|---|---|---|
| `api-key` | Yes | — | CodeRifts API key. Get one free at [coderifts.com](https://app.coderifts.com/api/signup). |
| `base-branch` | No | `main` | Base branch to compare against. |
| `fail-on-breaking` | No | `true` | Fail the workflow when breaking changes are detected. |

## Setup

1. Get a free API key at [app.coderifts.com/api/signup](https://app.coderifts.com/api/signup)
2. Add `CODERIFTS_API_KEY` as a repository secret in **Settings → Secrets and variables → Actions**
3. Add the workflow file above to `.github/workflows/api-governance.yml`
4. Every pull request that modifies an OpenAPI spec will now run a CodeRifts check

## What It Does

On every pull request, CodeRifts:

- Detects 10 types of breaking changes (endpoint removals, type changes, required field additions, etc.)
- Calculates a risk score (0–100) across 4 dimensions
- Checks policy violations (breaking budgets, freeze windows, no-delete rules)
- Runs security analysis (auth changes, sensitive field exposure)
- Posts a summary to the GitHub Actions job summary

## When to Use This vs. the GitHub App

| | GitHub App | GitHub Action |
|---|---|---|
| Setup | One-click install | Workflow file + API key |
| PR Comments | Automatic | Via job summary |
| Zero Config | Yes | Requires workflow file |
| Best For | Teams wanting zero setup | Teams wanting full CI control |

If you want zero-config PR comments with no workflow file, [install the GitHub App](https://github.com/apps/coderifts) instead.

## Links

- [CodeRifts Website](https://coderifts.com)
- [GitHub App](https://github.com/apps/coderifts)
- [Documentation](https://coderifts.com/docs/)
- [CLI on npm](https://www.npmjs.com/package/coderifts)

## License

Proprietary. See [Terms of Service](https://coderifts.com/terms/).
