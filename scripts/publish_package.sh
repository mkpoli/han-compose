#!/usr/bin/env bash
# Write the JavaScript package as it installs to the orphan branch `package`, so a site depends on it as
# `github:mkpoli/han-compose#package`. Nothing is pushed when the package's files are what the branch
# already holds. `gitHead` in the branch's package.json names the commit the files were built from.
#
#   scripts/publish_package.sh [--dry-run]
set -euo pipefail
shopt -s inherit_errexit
dry_run="${1:-}"
[ -z "$dry_run" ] || [ "$dry_run" = --dry-run ] || { echo "$dry_run is not a flag this script knows" >&2; exit 1; }
cd "$(git -C "$(dirname "$0")" rev-parse --show-toplevel)"
[ -z "$(git status --porcelain)" ] || { echo 'the tree has uncommitted changes' >&2; exit 1; }
head="$(git rev-parse HEAD)"
if [ -z "$dry_run" ]; then
  git fetch --quiet origin main
  git merge-base --is-ancestor "$head" FETCH_HEAD || { echo "$head is not on main" >&2; exit 1; }
fi
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

parent='' published=''
if git ls-remote --exit-code --heads origin package > /dev/null; then
  git fetch --quiet origin package
  parent="$(git rev-parse FETCH_HEAD)"
  published="$(git show "$parent:package.json" | jq -r .gitHead)"
  # A rerun of an older commit leaves the newer package in place.
  git merge-base --is-ancestor "$published" "$head" || { echo "$published, already published, is not behind $head" >&2; exit 1; }
fi

# The packed files, without what only a checkout of this repository can run.
rm -rf js/types
(cd js && bun pm pack --destination "$work" --quiet > /dev/null)
mkdir "$work/package"
tar -xzf "$work"/han-compose-*.tgz -C "$work/package" --strip-components=1
manifest="$(jq 'del(.scripts, .devDependencies)' "$work/package/package.json")"

# The tree of the packed files naming the commit $1, through an index of its own.
tree_naming() {
  jq --arg head "$1" '.gitHead = $head' <<< "$manifest" > "$work/package/package.json"
  GIT_INDEX_FILE="$work/index" git --work-tree="$work/package" add --all --force .
  GIT_INDEX_FILE="$work/index" git write-tree
}
if [ -n "$parent" ] && [ "$(tree_naming "$published")" = "$(git rev-parse "$parent^{tree}")" ]; then
  echo "the package is what $published published"
  exit 0
fi
commit="$(git commit-tree "$(tree_naming "$head")" ${parent:+-p "$parent"} -m "han-compose ${head:0:12}")"
echo "${head:0:12} packs as $commit, $(git ls-tree -r "$commit" | wc -l) files"
if [ "$dry_run" = --dry-run ]; then echo 'dry run: nothing pushed'; exit 0; fi
git push --quiet origin "$commit:refs/heads/package"
[ -z "${GITHUB_OUTPUT:-}" ] || echo 'published=true' >> "$GITHUB_OUTPUT"
