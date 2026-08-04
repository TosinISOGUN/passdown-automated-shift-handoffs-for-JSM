import { createRemoteJWKSet, jwtVerify } from 'jose';

// Forge Invocation Token (FIT) verification. Every request Forge sends to a
// remote carries a bearer JWT proving it genuinely came from Atlassian, aimed
// at this specific app. Rejecting anything that doesn't verify is the whole
// point of this check -- without it, this endpoint would be an open door to
// impersonate the site owner via anyone who discovers the Worker's URL.
const JWKS_URL = 'https://forge.cdn.prod.atlassian-dev.net/.well-known/jwks.json';
let jwks;

async function verifyForgeInvocationToken(request, appAri) {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Missing Forge invocation token');

  if (!jwks) jwks = createRemoteJWKSet(new URL(JWKS_URL));
  // `audience` is checked against the app's ARI -- confirmed via docs this is
  // the right claim to check, but the exact string Forge puts in `aud` (full
  // ARI vs just the app id) is unverified until tested against a real call.
  await jwtVerify(token, jwks, { audience: appAri });
}

// Exchanges the app's system token (received via the `x-forge-oauth-system`
// header, per the `auth.appSystemToken.enabled: true` remote config) for a
// token belonging to one specific, fixed user -- the site owner -- rather
// than whoever happens to be on-call. See the prompt for why.
async function getImpersonatedUserToken(systemToken, cloudId, accountId) {
  const contextId = `ari:cloud:jira:${cloudId}:workspace/${cloudId}`;
  const query = `
    mutation forge_remote_offlineUserAuthToken($input: OfflineUserAuthTokenInput!) {
      offlineUserAuthToken(input: $input) {
        success
        errors { message }
        authToken { token ttl }
      }
    }
  `;

  const response = await fetch('https://api.atlassian.com/graphql', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${systemToken}`,
    },
    body: JSON.stringify({
      query,
      variables: { input: { contextIds: [contextId], userId: accountId } },
    }),
  });

  if (!response.ok) {
    throw new Error(`offlineUserAuthToken request failed: ${response.status}`);
  }

  const { data, errors } = await response.json();
  if (errors?.length) {
    throw new Error(`offlineUserAuthToken GraphQL errors: ${JSON.stringify(errors)}`);
  }
  const result = data?.offlineUserAuthToken;
  if (!result?.success || !result.authToken?.token) {
    throw new Error(`offlineUserAuthToken did not succeed: ${JSON.stringify(result?.errors)}`);
  }

  return result.authToken.token;
}

// Direct external calls (bearer token, not going through Forge's own
// requestJira proxy) use Atlassian's public API gateway base, not the site's
// own domain -- /jsm/ops/api/... is only a valid path when requestJira
// resolves it internally, not as a literal public URL.
async function callJsmOpsApi(cloudId, userToken, path) {
  const response = await fetch(`https://api.atlassian.com/ex/jira/${cloudId}${path}`, {
    headers: { Authorization: `Bearer ${userToken}`, Accept: 'application/json' },
  });
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export default {
  async fetch(request, env) {
    try {
      await verifyForgeInvocationToken(request, env.FORGE_APP_ARI);
    } catch (err) {
      console.error('FIT verification failed:', err.message);
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401 });
    }

    const systemToken = request.headers.get('x-forge-oauth-system');
    if (!systemToken) {
      return new Response(JSON.stringify({ error: 'missing system token' }), { status: 401 });
    }

    const url = new URL(request.url);
    const cloudId = url.searchParams.get('cloudId');
    if (!cloudId) {
      return new Response(JSON.stringify({ error: 'missing cloudId query param' }), {
        status: 400,
      });
    }

    let userToken;
    try {
      userToken = await getImpersonatedUserToken(systemToken, cloudId, env.IMPERSONATE_ACCOUNT_ID);
    } catch (err) {
      console.error('Impersonation failed:', err.message);
      return new Response(JSON.stringify({ error: 'impersonation failed' }), { status: 502 });
    }

    // Path is whatever the Forge function asked for, e.g. /jsm/ops/api/v1/schedules
    // or /jsm/ops/api/v1/schedules/{id}/on-calls -- this Worker is a thin,
    // path-preserving proxy, not a reimplementation of the Ops API shape.
    return callJsmOpsApi(cloudId, userToken, url.pathname);
  },
};
