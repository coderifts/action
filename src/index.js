const fs = require('fs');
const os = require('os');
const path = require('path');
const core = require('@actions/core');
const exec = require('@actions/exec');

/*
 * 2026-10-25: the action ran `coderifts check --base … --fail …`, a subcommand no released CLI has
 * (8.8.0: "error: unknown command 'check'", exit 1), so every run failed before comparing anything.
 * It now runs the command the CLI exposes for this step: `coderifts diff <base spec> <head spec>`,
 * with --ci when fail-on-breaking is true (exit 1 on a break, exit 2 when the analysis could not decide).
 */

/** Run a command and capture stdout; never throws on a non-zero exit. */
async function capture(cmd, args, options = {}) {
  let stdout = '';
  let stderr = '';
  const code = await exec.exec(cmd, args, {
    ...options,
    silent: true,
    ignoreReturnCode: true,
    listeners: { stdout: (d) => { stdout += d.toString(); }, stderr: (d) => { stderr += d.toString(); } },
  });
  return { code, stdout, stderr };
}

async function run() {
  try {
    const apiKey = core.getInput('api-key', { required: true });
    const baseBranch = core.getInput('base-branch') || 'main';
    const failOnBreaking = core.getInput('fail-on-breaking') !== 'false';
    const specPath = core.getInput('spec-path') || 'api/openapi.yaml';

    // Install the CLI only when it is not already on PATH.
    const present = await capture('coderifts', ['--version']).catch(() => ({ code: 1 }));
    if (present.code !== 0) {
      core.info('Installing CodeRifts CLI...');
      await exec.exec('npm', ['install', '-g', 'coderifts@latest']);
    }

    if (!fs.existsSync(specPath)) {
      core.setFailed(`CodeRifts: ${specPath} is not in this checkout — set the spec-path input.`);
      return;
    }

    // actions/checkout fetches one commit by default: bring the base branch in, then read the spec there.
    await capture('git', ['fetch', '--quiet', '--depth=1', 'origin', baseBranch]);
    let base = await capture('git', ['show', `origin/${baseBranch}:${specPath}`]);
    if (base.code !== 0) base = await capture('git', ['show', `${baseBranch}:${specPath}`]);
    if (base.code !== 0) {
      core.info(`CodeRifts: ${specPath} does not exist on ${baseBranch} — a new contract, nothing to compare against.`);
      return;
    }
    const baseSpec = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'coderifts-')), path.basename(specPath));
    fs.writeFileSync(baseSpec, base.stdout);

    core.info('Running CodeRifts API governance check (coderifts diff)...');
    let output = '';
    const args = ['diff', baseSpec, specPath, '--format', 'markdown', ...(failOnBreaking ? ['--ci'] : [])];
    const exitCode = await exec.exec('coderifts', args, {
      env: { ...process.env, CODERIFTS_API_KEY: apiKey },
      listeners: { stdout: (data) => { output += data.toString(); } },
      ignoreReturnCode: true,
    });

    // Post summary to GitHub Actions job summary
    if (output && process.env.GITHUB_STEP_SUMMARY) {
      await core.summary
        .addHeading('CodeRifts API Governance Report')
        .addRaw(output)
        .write();
    }

    if (exitCode === 2) {
      core.setFailed('CodeRifts could not decide (ANALYSIS_FAILED, NOT_SUPPORTED or degraded) — see the report above.');
    } else if (exitCode !== 0 && failOnBreaking) {
      core.setFailed('Breaking API changes detected. See the CodeRifts report above for details.');
    } else if (exitCode !== 0) {
      core.warning('CodeRifts exited non-zero, but fail-on-breaking is disabled.');
    } else {
      core.info('No breaking API changes detected.');
    }
  } catch (error) {
    core.setFailed(`CodeRifts Action failed: ${error.message}`);
  }
}

run();
