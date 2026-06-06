# Contributing to datapack

Thank you for your interest in contributing to datapack!

## How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run tests: `npm test`
5. Lint and format: `npm run lint` and `npm run format`
6. Commit your changes
7. Push to your branch and open a Pull Request

## Development Setup

```bash
npm install
npm run build
npm test
```

## Reporting Bugs

Open an issue at https://github.com/nmhung1210/datapack/issues with:

- A clear description of the bug
- Steps to reproduce
- Expected vs actual behavior

## Code Style

- Write TypeScript
- Follow existing patterns in the codebase
- Add tests for new functionality
- Code style is enforced with ESLint and Prettier:
  - `npm run lint` — report lint problems (`npm run lint:fix` to auto-fix)
  - `npm run format` — format all files with Prettier (`npm run format:check` to verify without writing)

  Configuration lives in `eslint.config.js` and `.prettierrc.json`.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
