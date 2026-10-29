# Development

Requires Node.js 22.19+.

```sh
npm ci --ignore-scripts
npm run check
npm pack --dry-run
```

Tests use a mock Pi event API and need no model credentials or Herdr process.
For a live check, load `src/index.ts` once in a Herdr Pi pane, open a question or
permission dialog, and verify blocked/clear state. Test sounds from a background
workspace. Do not load both this package and a standalone copy of the bridge.

# Release

No workflow publishes automatically. Before each release:

1. Review the README, diff and `npm pack --dry-run` file list.
2. Check for credentials, personal paths, logs and session data.
3. Obtain the maintainer's approval before pushing or publishing.
4. Commit the reviewed files and push the matching version tag to GitHub.
5. Authenticate to npm, then run `npm publish --access public`.

Keep GitHub tags and the npm package version aligned. Never store npm tokens in
this repository or pass them in command-line arguments.
