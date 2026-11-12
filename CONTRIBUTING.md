# Contributing to Astro Vital

Thanks for helping the crew. This project is intentionally small: plain HTML, CSS and JavaScript, no build step, no dependencies. Keep it that way unless there is a strong reason.

## Getting started

```bash
git clone https://github.com/MehdiCherkane/space-health-monitor.git
cd space-health-monitor
```

The application is under active development. Once the first version lands, open `index.html` in a browser or serve the folder:

```bash
python -m http.server 8000
```

## Ways to contribute

- **Bug reports** — open an issue with steps to reproduce, expected vs. actual behavior, and your browser.
- **Feature ideas** — open an issue describing the crew problem first, then the proposed change.
- **Health ranges** — these are the product's core logic. Cite a source (NASA HRP, WHO, or clinical guidance) in the PR and update the ranges table in the README.
- **UI and accessibility** — keyboard navigation, screen-reader output, contrast and small-screen layouts are always welcome.

## Workflow

1. Fork the repo, or create a branch if you have write access.
2. Branch from `main` using `type/short-description`, e.g. `feat/sleep-trends`, `fix/spo2-boundary`, `docs/readme-setup`.
3. Make one focused change. Keep unrelated refactors out of the same PR.
4. Open a pull request describing **what changed, why, and how you tested it**.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add sleep trend sparkline
fix: treat SpO2 of 90 as watch, not nominal
docs: clarify local server setup
test: cover high-side temperature advice
```

## Code guidelines

- No new dependencies without a discussion in an issue.
- Keep threshold ranges in a single source of truth; do not duplicate them across files.
- Build DOM with `textContent`/`createElement`, never `innerHTML` with user data.
- Keep check-in data on-device; do not add network calls that would send health data off the client.
- Update `README.md` when behavior, setup, or the range table changes.
- All UI must remain usable with a keyboard and announced correctly by screen readers.

## Review and ownership

`@MehdiCherkane` is the code owner for all files (see [`.github/CODEOWNERS`](.github/CODEOWNERS)) and reviews every change.

## Code of conduct

Be respectful, assume good intent, and keep feedback about the code. Harassment or personal attacks are not tolerated.

## Medical disclaimer

This software is a challenge prototype, not a medical device. Contributions must not imply clinical certification or replace the flight surgeon's judgment.
