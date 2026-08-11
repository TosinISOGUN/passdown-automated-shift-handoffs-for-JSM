import Resolver from '@forge/resolver';
import api from '@forge/api';
import { summarizeIssue } from '../lib/summarize';

const resolver = new Resolver();

// `context.license` is only populated for listed Marketplace apps in production, so when
// it's undefined (dev, unlisted, custom envs) we do not gate -- production installs always
// carry a license object and are enforced. Same pattern as Recap's resolver.
function isUnlicensed(context) {
  return Boolean(context && context.license) && context.license.active !== true;
}

// The one resolver the issue panel calls. A real person clicked the button, so
// this runs as asUser() (their own permissions, per the shared AGENTS.md's stated
// preference when a user is in session -- unlike the scheduled trigger, which has
// no user and must use asApp()).
resolver.define('summarizeTicket', async ({ context }) => {
  if (isUnlicensed(context)) {
    return { unlicensed: true };
  }

  const issueKey = context?.extension?.issue?.key;
  if (!issueKey) {
    throw new Error('No issue key available in context');
  }

  return summarizeIssue(api.asUser(), issueKey, { style: 'brief' });
});

export const handler = resolver.getDefinitions();
