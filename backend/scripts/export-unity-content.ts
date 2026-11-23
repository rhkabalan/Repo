/**
 * Writes the bilingual content catalog for the Unity client, so both games share one
 * source of truth. Run: npm run export:unity
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalog } from '../src/journey/content/catalog.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, '../../unity/ATHAR/Assets/ATHAR/Resources/Content/catalog.json');
mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(catalog, null, 1) + '\n');
console.log(`wrote ${path.relative(process.cwd(), out)}`);
