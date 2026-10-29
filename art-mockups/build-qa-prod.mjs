/**
 * Builds the self-contained production-art QA sheet: inlines the shipped
 * assets/pet/mochi.svg into qa-prod.html.
 *
 * Run after scripts/build-pixel-mochi.mjs:  node art-mockups/build-qa-prod.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(HERE, 'qa-prod.html'), 'utf8');
const art = readFileSync(join(HERE, '..', 'assets', 'pet', 'mochi.svg'), 'utf8');

const html = template.replace('%PROD%', () => art);
writeFileSync(join(HERE, 'qa-prod-final.html'), html);
console.log('wrote qa-prod-final.html (self-contained)');
