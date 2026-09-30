#!/usr/bin/env node
/**
 * Validate the marketplace catalog against the plugins on disk.
 *
 * This repository had no CI at all. Its content is a catalog that Genie reads to
 * offer plugins, and every failure mode here is the same shape: the catalog says
 * something the disk does not, and nobody finds out until a user tries to install.
 *
 * What is checked, and the bug each one is:
 *
 *  - every JSON parses — a malformed catalog offers NOTHING, and the error
 *    surfaces wherever it is read rather than here;
 *  - every catalog entry's `path` exists and holds a `genie-plugin.json` — an
 *    entry pointing at nothing is an install that fails after the user chose it;
 *  - `id` and `version` AGREE between the catalog and the plugin's own manifest —
 *    a catalog claiming 0.1.0 of a plugin that says 0.2.0 installs something other
 *    than what was advertised, silently;
 *  - every plugin directory appears in the catalog — an unlisted plugin is one
 *    nobody can reach, which reads as it being broken rather than unpublished;
 *  - ids are unique — two entries with one id means whichever loses is unreachable.
 *
 * Exits 0 when the catalog and the disk agree, 1 with every problem listed.
 * ALL problems, not the first: being told about one, fixing it, and being told
 * about the next is what makes people stop reading.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const note = (msg) => problems.push(msg);

function readJson(path, label) {
    try {
        return JSON.parse(readFileSync(path, 'utf8'));
    } catch (err) {
        note(`${label} (${path}) is not valid JSON: ${err.message}`);
        return null;
    }
}

const catalogPath = join(root, 'genie-marketplace.json');
if (!existsSync(catalogPath)) {
    console.error(`No catalog at ${catalogPath}`);
    process.exit(1);
}

const catalog = readJson(catalogPath, 'the catalog');

if (catalog) {
    const entries = Array.isArray(catalog.plugins) ? catalog.plugins : null;
    if (!entries) {
        note('the catalog has no `plugins` array — it offers nothing');
    } else {
        const seen = new Map();
        const listedPaths = new Set();

        for (const entry of entries) {
            const label = entry?.id ?? entry?.name ?? '(an entry with no id)';

            for (const field of ['id', 'name', 'version', 'path']) {
                if (typeof entry?.[field] !== 'string' || entry[field] === '') {
                    note(`${label}: missing \`${field}\``);
                }
            }
            if (typeof entry?.path !== 'string') continue;

            if (seen.has(entry.id)) {
                note(`${entry.id}: listed twice — whichever loses is unreachable`);
            }
            seen.set(entry.id, entry);
            listedPaths.add(entry.path);

            const dir = join(root, entry.path);
            if (!existsSync(dir) || !statSync(dir).isDirectory()) {
                note(`${label}: \`path\` points at ${entry.path}, which does not exist`);
                continue;
            }

            const manifestPath = join(dir, 'genie-plugin.json');
            if (!existsSync(manifestPath)) {
                note(`${label}: ${entry.path} has no genie-plugin.json`);
                continue;
            }

            const manifest = readJson(manifestPath, `${label}'s manifest`);
            if (!manifest) continue;

            if (manifest.id !== entry.id) {
                note(
                    `${label}: the catalog says id "${entry.id}", the plugin says "${manifest.id}"`,
                );
            }
            if (manifest.version !== entry.version) {
                note(
                    `${label}: the catalog offers version ${entry.version}, the plugin is ${manifest.version} — ` +
                        'a user would install something other than what was advertised',
                );
            }
        }

        // The other direction. Everything above walks the catalog, so a plugin
        // that exists and is listed NOWHERE passes all of it — and is invisible.
        const pluginsDir = join(root, 'plugins');
        if (existsSync(pluginsDir)) {
            for (const name of readdirSync(pluginsDir)) {
                const dir = join(pluginsDir, name);
                if (!statSync(dir).isDirectory()) continue;
                if (!existsSync(join(dir, 'genie-plugin.json'))) continue;
                if (!listedPaths.has(`plugins/${name}`)) {
                    note(`plugins/${name} exists but is in no catalog entry — nobody can install it`);
                }
            }
        }
    }
}

if (problems.length > 0) {
    console.error(`The catalog and the plugins on disk disagree (${problems.length}):\n`);
    for (const p of problems) console.error(`  • ${p}`);
    process.exit(1);
}

console.log('Catalog and plugins agree.');
