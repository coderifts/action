const core = require('@actions/core');
const exec = require('@actions/exec');

async function run() {
  try {
    const apiKey = core.getInput('api-key', { required: true });
    const baseBranch = core.getInput('base-branch') || 'main';
    const failOnBreaking = core.getInput('fail-on-breaking') !== 'false';

    // Install CodeRifts CLI
    core.info('Installing CodeRifts CLI...');
    await exec.exec('npm', ['install', '-g', 'coderifts@latest']);

    // Run CodeRifts check
    core.info('Running CodeRifts API governance check...');
    let output = '';
    let errorOutput = '';

    const options = {
      env: {
        ...process.env,
        CODERIFTS_API_KEY: apiKey,
      },
      listeners: {
        stdout: (data) => { output += data.toString(); },
        stderr: (data) => { errorOutput += data.toString(); },
      },
      ignoreReturnCode: true,
    };

    const exitCode = await exec.exec(
      'coderifts',
      ['check', '--base', baseBranch, '--fail', String(failOnBreaking)],
      options
    );

    // Post summary to GitHub Actions job summary
    if (output) {
      await core.summary
        .addHeading('CodeRifts API Governance Report')
        .addRaw(output)
        .write();
    }

    if (exitCode !== 0 && failOnBreaking) {
      core.setFailed('Breaking API changes detected. See the CodeRifts report above for details.');
    } else if (exitCode !== 0) {
      core.warning('Breaking API changes detected, but fail-on-breaking is disabled.');
    } else {
      core.info('No breaking API changes detected.');
    }
  } catch (error) {
    core.setFailed(`CodeRifts Action failed: ${error.message}`);
  }
}

run();
