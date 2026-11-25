import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Simple utility to automatically stage all changes, commit with a timestamped message,
 * and push to the remote "origin".
 *
 * Intended to be run from CI after a successful build. It assumes that the CI
 * environment has a valid GitHub token set in the `GITHUB_TOKEN` environment
 * variable and that the remote URL is already configured with authentication.
 */

function run(command: string): string {
  return execSync(command, { stdio: 'pipe' }).toString().trim();
}

function main() {
  const cwd = process.cwd();
  console.log(`Running git-auto-push in ${cwd}`);

  // Stage all changes
  run('git add .');

  // Create a commit message with date
  const date = new Date().toISOString();
  const message = `ci: auto‑push after successful CI ${date}`;

  // Check if there are any staged changes
  const status = run('git status --porcelain');
  if (!status) {
    console.log('No changes to commit.');
    return;
  }

  // Commit
  run(`git commit -m "${message}"`);

  // Push – use token if provided
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    // Rewrite remote URL to include token for authentication
    const remoteUrl = run('git remote get-url origin');
    const authUrl = remoteUrl.replace(/^https:\/\//, `https://${token}@`);
    run(`git remote set-url origin "${authUrl}"`);
  }

  // Push to origin (default branch assumed)
  run('git push origin HEAD');
  console.log('Push completed.');
}

main();
