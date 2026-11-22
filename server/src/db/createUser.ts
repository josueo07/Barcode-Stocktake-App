/**
 * Creates a user from the command line. Use it once on the server to create the first
 * supervisor; after that, supervisors can add people from the app.
 *
 *   npm run user:create -w server -- --username ana --name "Ana Rivera" --role supervisor
 *
 * The PIN is read from the STOCKTAKE_PIN environment variable or prompted for, so it never
 * lands in shell history.
 */
import readline from 'node:readline';
import { parseArgs } from 'node:util';
import { env } from '../config/env';
import { createUser } from '../services/auth.service';
import { createDatabase } from './client';

async function promptHidden(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  const output = rl as unknown as {
    _writeToOutput: (s: string) => void;
    output: NodeJS.WriteStream;
  };
  output._writeToOutput = (s: string) => {
    if (s.includes(question)) output.output.write(s);
  };
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  process.stdout.write('\n');
  return answer;
}

async function main() {
  const { values } = parseArgs({
    options: {
      username: { type: 'string' },
      name: { type: 'string' },
      role: { type: 'string', default: 'counter' },
    },
  });
  if (!values.username || !values.name) {
    throw new Error('Usage: --username <user> --name "<Display Name>" [--role supervisor|counter]');
  }
  if (values.role !== 'supervisor' && values.role !== 'counter') {
    throw new Error('--role must be supervisor or counter');
  }
  const pin = process.env.STOCKTAKE_PIN ?? (await promptHidden('PIN (min 6 characters): '));

  const { db, sqlite } = createDatabase(env.databasePath);
  try {
    const user = createUser(db, {
      username: values.username,
      displayName: values.name,
      role: values.role,
      pin,
    });
    // eslint-disable-next-line no-console
    console.log(`Created ${user.role} "${user.username}" (${user.displayName})`);
  } finally {
    sqlite.close();
  }
}

main().catch((err: Error) => {
  // eslint-disable-next-line no-console
  console.error(err.message);
  process.exit(1);
});
