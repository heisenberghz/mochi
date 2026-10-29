/**
 * Builds the self-contained mockup sheet: inlines the two candidates and
 * the current production art into preview-final.html (so it works from a
 * plain file:// open in any browser — no server needed).
 *
 * Run after build-pixel-mochi.mjs:  node art-mockups/build-preview.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(HERE, 'preview.html'), 'utf8');
const bold = readFileSync(join(HERE, 'mochi-bold.svg'), 'utf8');
const pixel = readFileSync(join(HERE, 'mochi-pixel.svg'), 'utf8');
const current = readFileSync(join(HERE, '..', 'assets', 'pet', 'mochi.svg'), 'utf8');

const html = template
  .replace('%BOLD%', () => bold)
  .replace('%PIXEL%', () => pixel)
  .replace('%CURRENT%', () => current);
writeFileSync(join(HERE, 'preview-final.html'), html);
console.log('wrote preview-final.html (self-contained)');
