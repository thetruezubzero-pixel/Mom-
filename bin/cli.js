#!/usr/bin/env node
const readline = require('readline');
const { respond } = require('../lib/agents');
const { listLenses } = require('../lib/lenses');

let currentLens = 'literal';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  prompt: `[${currentLens}]> `,
});

console.log('mom-assistant CLI');
console.log(`Lenses available: ${listLenses().join(', ')}`);
console.log('Commands: :lens <name>   :lenses   :exit');
console.log('Type anything else to get a primary + twin response.\n');

rl.prompt();

rl.on('line', (line) => {
  const input = line.trim();

  if (input === ':exit') {
    rl.close();
    return;
  }

  if (input === ':lenses') {
    console.log(listLenses().join(', '));
    rl.prompt();
    return;
  }

  if (input.startsWith(':lens ')) {
    const name = input.slice(':lens '.length).trim();
    if (listLenses().includes(name)) {
      currentLens = name;
      rl.setPrompt(`[${currentLens}]> `);
      console.log(`Switched to lens: ${name}`);
    } else {
      console.log(`Unknown lens: ${name}. Available: ${listLenses().join(', ')}`);
    }
    rl.prompt();
    return;
  }

  if (input === '') {
    rl.prompt();
    return;
  }

  const [primary, twin] = respond(input, currentLens);
  console.log(`\nprimary (${primary.lens}):\n  ${primary.text}\n`);
  console.log(`twin (${twin.lens}):\n  ${twin.text}\n`);
  rl.prompt();
});

rl.on('close', () => {
  console.log('\nExiting.');
  process.exit(0);
});
