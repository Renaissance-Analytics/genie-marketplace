#!/usr/bin/env bash
#
# Exercise scripts/validate-catalog.mjs against built fixtures.
#
# A validator is the one kind of script where "it passed" proves least: one that
# exits 0 unconditionally passes on the real catalog exactly as a working one
# does. So every check is tested from BOTH sides — a fixture it must reject, and
# the real catalog it must accept.
#
# Fixtures are built in a temp dir, never in the repo, so a failure cannot leave
# the catalog altered.

set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo=$(cd "$here/../.." && pwd)
validator="$repo/scripts/validate-catalog.mjs"

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

fail=0
check() {
    local name="$1" expected="$2" actual="$3"
    if [ "$expected" = "$actual" ]; then
        echo "ok   $name"
    else
        echo "FAIL $name — expected exit $expected, got $actual"
        fail=1
    fi
}

run_on() {
    set +e
    node "$validator" "$1" >/dev/null 2>&1
    local code=$?
    set -e
    echo "$code"
}

# Build a minimal, VALID marketplace, then break one thing per case.
scaffold() {
    local dir="$1"
    mkdir -p "$dir/plugins/alpha"
    cat > "$dir/plugins/alpha/genie-plugin.json" <<'JSON'
{ "id": "ai.genie.alpha", "name": "Alpha", "version": "1.0.0" }
JSON
    cat > "$dir/genie-marketplace.json" <<'JSON'
{
  "id": "test",
  "name": "Test",
  "plugins": [
    { "id": "ai.genie.alpha", "name": "Alpha", "version": "1.0.0", "path": "plugins/alpha" }
  ]
}
JSON
}

# --- the POSITIVE CONTROL, first ------------------------------------------
# Without this, a validator that rejected everything would pass every case below.
scaffold "$work/good"
check 'accepts a catalog that agrees with the disk' 0 "$(run_on "$work/good")"

# --- a version that drifted ------------------------------------------------
scaffold "$work/version"
node -e '
const fs=require("fs"); const p=process.argv[1]+"/genie-marketplace.json";
const c=JSON.parse(fs.readFileSync(p)); c.plugins[0].version="2.0.0";
fs.writeFileSync(p, JSON.stringify(c));
' "$work/version"
check 'rejects a catalog version the plugin disagrees with' 1 "$(run_on "$work/version")"

# --- a path pointing at nothing --------------------------------------------
scaffold "$work/missing"
node -e '
const fs=require("fs"); const p=process.argv[1]+"/genie-marketplace.json";
const c=JSON.parse(fs.readFileSync(p)); c.plugins[0].path="plugins/nope";
fs.writeFileSync(p, JSON.stringify(c));
' "$work/missing"
check 'rejects an entry whose path does not exist' 1 "$(run_on "$work/missing")"

# --- a plugin nobody listed -------------------------------------------------
scaffold "$work/orphan"
mkdir -p "$work/orphan/plugins/beta"
cat > "$work/orphan/plugins/beta/genie-plugin.json" <<'JSON'
{ "id": "ai.genie.beta", "name": "Beta", "version": "1.0.0" }
JSON
check 'rejects a plugin that is in no catalog entry' 1 "$(run_on "$work/orphan")"

# --- two entries, one id ----------------------------------------------------
scaffold "$work/dupe"
node -e '
const fs=require("fs"); const p=process.argv[1]+"/genie-marketplace.json";
const c=JSON.parse(fs.readFileSync(p)); c.plugins.push({...c.plugins[0]});
fs.writeFileSync(p, JSON.stringify(c));
' "$work/dupe"
check 'rejects a duplicated id' 1 "$(run_on "$work/dupe")"

# --- malformed JSON ---------------------------------------------------------
scaffold "$work/broken"
printf '{ not json' > "$work/broken/genie-marketplace.json"
check 'rejects a catalog that is not JSON' 1 "$(run_on "$work/broken")"

# --- and the REAL catalog still passes --------------------------------------
# The check that keeps the fixtures honest: they are a model of the real thing,
# and a validator tuned only to fixtures would drift away from what ships.
check 'accepts the real catalog in this repo' 0 "$(run_on "$repo")"

exit "$fail"
