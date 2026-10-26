#!/usr/bin/env bash
# Creates the five canonical triage labels on this repo's GitHub tracker.
# Run after `gh auth login`. Safe to re-run: --force updates existing labels.
set -euo pipefail

gh label create needs-triage    --color FBCA04 --description "Maintainer needs to evaluate this issue"  --force
gh label create needs-info      --color D4C5F9 --description "Waiting on reporter for more information" --force
gh label create ready-for-agent --color 0E8A16 --description "Fully specified, ready for an AFK agent"  --force
gh label create ready-for-human --color 1D76DB --description "Requires human implementation"            --force
gh label create wontfix         --color FFFFFF --description "Will not be actioned"                      --force

echo "Triage labels created/updated."
