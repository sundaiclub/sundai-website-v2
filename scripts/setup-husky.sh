#!/bin/bash

# Setup husky for pre-commit hooks
echo "Setting up husky..."

# Install husky
npx husky install

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run lint && npm run test:ci && npm run build"

# Make the hook executable
chmod +x .husky/pre-commit

echo "Husky setup complete!"
echo "Pre-commit hooks will now run:"
echo "1. Linting (eslint)"
echo "2. Tests (jest)"
echo "3. Build (next build)"
