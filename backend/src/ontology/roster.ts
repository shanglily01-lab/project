// ─── Roster seed ──────────────────────────────────────
// Cross-source identity seed. The same array seeds the in-memory identity
// index and the ops_person_identity table (npm run db:seed).
//
// One entry per team member. Fields:
//   • opName   — the EXACT OpenProject display name (verify with `npm run op:check`)
//   • gitEmails— every git author email this person commits under
//   • iamArn   — optional AWS IAM ARN, if you attribute commits by IAM identity
//
// Replace the examples below with your own team.

import type { PersonIdentity } from './identity.js';

export const ROSTER: PersonIdentity[] = [
  {
    personId: 1,
    name: 'Alice',
    opName: 'Alice Example', // exact OpenProject display name
    gitEmails: ['alice@example.com'],
    iamArn: null,
    active: true,
  },
  {
    personId: 2,
    name: 'Bob',
    opName: 'Bob Example',
    gitEmails: ['bob@example.com'],
    iamArn: null,
    active: true,
  },
];
