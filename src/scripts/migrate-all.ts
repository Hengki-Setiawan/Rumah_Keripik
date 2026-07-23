import { spawnSync } from 'child_process';

const commands: Array<[string, string[]]> = [
  ['npm', ['run', 'db:migrate:v3']],
  ['npm', ['run', 'db:migrate:v4']],
  ['npm', ['run', 'db:migrate:v5']],
  ['npm', ['run', 'db:migrate:public-ordering']],
  ['npm', ['run', 'db:migrate:v6']],
  ['npm', ['run', 'db:migrate:v7']],
  ['npm', ['run', 'db:migrate:v8']],
  ['npm', ['run', 'db:migrate:v9']],
  ['npm', ['run', 'db:migrate:v10']],
  ['npm', ['run', 'db:migrate:v11']],
  ['npm', ['run', 'db:migrate:v12']],
];

for (const [cmd, args] of commands) {
  console.log(`\n> ${cmd} ${args.join(' ')}`);
  const result = spawnSync(process.platform === 'win32' && cmd === 'npm' ? 'npm.cmd' : cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log('\nAll runtime migrations completed.');
