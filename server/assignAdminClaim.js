/**
 * assignAdminClaim.js
 *
 * Admin-only script to set Firebase Custom Claims for a user.
 *
 * Usage:
 *   node server/assignAdminClaim.js <uid>
 *
 * Optional:
 *   node server/assignAdminClaim.js <uid> --revoke
 *
 * Credentials:
 *   - FIREBASE_SERVICE_ACCOUNT_JSON: JSON string of a service account
 *   - OR set GOOGLE_APPLICATION_CREDENTIALS to a service account file
 *   - OR run in GCP where Application Default Credentials are available
 */

'use strict';

const { initFirebaseAdmin } = require('./firebaseAdmin');

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length < 1 || args.length > 2) return { uid: null, revoke: false };
  const [uid, option] = args;
  if (!uid || uid.startsWith('--') || (option && option !== '--revoke')) {
    return { uid: null, revoke: false };
  }

  return { uid, revoke: option === '--revoke' };
}

async function main() {
  const { uid, revoke } = parseArgs(process.argv);

  if (!uid) {
    console.error('Missing UID.\nUsage: node server/assignAdminClaim.js <uid> [--revoke]');
    process.exit(1);
  }

  try {
    const admin = initFirebaseAdmin();
    const user = await admin.auth().getUser(uid);
    const claims = { ...(user.customClaims || {}) };

    if (revoke) delete claims.admin;
    else claims.admin = true;

    await admin.auth().setCustomUserClaims(uid, claims);

    console.log(
      `[assignAdminClaim] ${revoke ? 'Revoked' : 'Granted'} admin claim for uid=${uid}`
    );
    console.log(
      '[assignAdminClaim] Next step (important): the client must refresh ID token to see changes: auth.currentUser.getIdToken(true)'
    );

    process.exit(0);
  } catch (err) {
    console.error('[assignAdminClaim] Failed to set custom user claims:', err);
    process.exit(2);
  }
}

main();
