/*
  One-time script to set Firebase custom claims for an admin user.

  Usage:
    1) Ensure Firebase Admin credentials are available:
       - Recommended: set FIREBASE_SERVICE_ACCOUNT_JSON to the JSON content of your service account
       - Or: run with GOOGLE_APPLICATION_CREDENTIALS (application default credentials)

    2) Run:
       node setAdminClaim.js <uid>

    Example:
       node setAdminClaim.js ADMIN_USER_UID

  Note:
    After setting custom claims, the user must sign out/in (or refresh their token)
    for the new claims to take effect.
*/

const { initFirebaseAdmin } = require('./firebaseAdmin');

(async () => {
  try {
    const admin = initFirebaseAdmin();

    const uidFromArg = process.argv[2];
    const uidFromEnv = process.env.YkHpl978BoYiPQOrOKhPkdSY1pu2;
    const uid = uidFromArg || uidFromEnv;

    if (!uid) {
      console.error('Missing UID. Provide it as: node setAdminClaim.js <uid> OR set YkHpl978BoYiPQOrOKhPkdSY1pu2 env var.');
      process.exit(1);
    }

    // Matches the snippet you provided:
    // await admin.auth().setCustomUserClaims(uid, { admin: true })
    await admin.auth().setCustomUserClaims(uid, { admin: true });

    console.log('Admin claim set for uid:', uid);
    process.exit(0);
  } catch (err) {
    console.error('Failed to set admin claim:', err);
    process.exit(1);
  }
})();

