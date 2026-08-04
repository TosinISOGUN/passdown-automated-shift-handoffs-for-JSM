import Resolver from '@forge/resolver';
import api from '@forge/api';
import { summarizeIssue } from '../lib/summarize';

const resolver = new Resolver();

// The one resolver the issue panel calls. A real person clicked the button, so
// this runs as asUser() (their own permissions, per the shared AGENTS.md's stated
// preference when a user is in session -- unlike the scheduled trigger, which has
// no user and must use asApp()).
resolver.define('summarizeTicket', async ({ context }) => {
  const issueKey = context?.extension?.issue?.key;
  if (!issueKey) {
    throw new Error('No issue key available in context');
  }

  return summarizeIssue(api.asUser(), issueKey, { style: 'brief' });
});

export const handler = resolver.getDefinitions();
