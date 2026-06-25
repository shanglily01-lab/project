// ─── OpenProject users probe / roster source ─────────
// Fetches all OpenProject users (name + email + status) and cross-checks them
// against the assignees that actually appear in ops_tasks.
//   npm run op:users

import { loadEnv } from './env.js';
import { getAllTasks } from '../db/repository.js';
import { queryClient } from '../db/client.js';

loadEnv();

const OP_TARGET = process.env.OP_TARGET || '';
const OP_TOKEN = process.env.OP_TOKEN || '';

interface OpUser {
  id: number;
  name: string;
  firstName?: string;
  lastName?: string;
  login?: string;
  email?: string;
  status?: string;
}

function authHeader() {
  return { Authorization: 'Basic ' + Buffer.from('apikey:' + OP_TOKEN).toString('base64') };
}

async function fetchUsers(): Promise<OpUser[]> {
  let offset = 1;
  const pageSize = 200;
  let total = Infinity;
  const all: OpUser[] = [];
  while (all.length < total) {
    const url = `${OP_TARGET}/api/v3/users?pageSize=${pageSize}&offset=${offset}`;
    const resp = await fetch(url, { headers: authHeader() });
    if (!resp.ok) throw new Error(`users API ${resp.status}: ${resp.statusText}`);
    const data = await resp.json() as { total?: number; _embedded?: { elements?: OpUser[] } };
    total = data.total ?? all.length;
    all.push(...(data._embedded?.elements ?? []));
    offset++;
    if ((data._embedded?.elements ?? []).length === 0) break;
  }
  return all;
}

async function main() {
  if (!OP_TOKEN) {
    console.error('✗ Missing OP_TOKEN');
    process.exit(1);
  }
  const users = await fetchUsers();
  console.log(`✓ ${users.length} OpenProject users\n`);
  console.log('id'.padEnd(6), 'name'.padEnd(26), 'email'.padEnd(34), 'status');
  for (const u of users) {
    console.log(
      String(u.id).padEnd(6),
      (u.name ?? '').padEnd(26),
      (u.email ?? '—').padEnd(34),
      u.status ?? '',
    );
  }

  // who actually has tasks?
  const tasks = await getAllTasks();
  const assignees = new Set(tasks.map((t) => t.assignee).filter((a) => a && a !== 'Unassigned'));
  const userNames = new Set(users.map((u) => u.name));
  const assigneesNoUser = [...assignees].filter((a) => !userNames.has(a));
  console.log(`\nDistinct task assignees: ${assignees.size}`);
  if (assigneesNoUser.length) {
    console.log('Assignees with NO matching user record:', assigneesNoUser);
  }

  await queryClient.end();
}

main().catch((err) => {
  console.error('✗ op:users failed:', err.message ?? err);
  process.exit(1);
});
