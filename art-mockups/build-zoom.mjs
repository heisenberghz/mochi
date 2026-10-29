/**
 * Builds the self-contained 2x zoom sheet: inlines the two candidates and
 * the current production art into zoom-final.html.
 *
 * Run after the generators:  node art-mockups/build-zoom.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const template = readFileSync(join(HERE, 'zoom.html'), 'utf8');
const bold = readFileSync(join(HERE, 'mochi-bold.svg'), 'utf8');
const pixel = readFileSync(join(HERE, 'mochi-pixel.svg'), 'utf8');
const current = readFileSync(join(HERE, '..', 'assets', 'pet', 'mochi.svg'), 'utf8');

const html = template
  .replace('%BOLD%', () => bold)
  .replace('%PIXEL%', () => pixel)
  .replace('%CURRENT%', () => current);
writeFileSync(join(HERE, 'zoom-final.html'), html);
console.log('wrote zoom-final.html (self-contained)');
