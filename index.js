const express = require('express');
const cors = require('cors');
const { initFirebaseAdmin } = require('./firebaseAdmin');

initFirebaseAdmin();

const app = express();

// Important: use raw body for Paystack signature verification.
// We'll re-use the raw request body in the webhook route.
app.use(cors());

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/api/paystack/webhook', express.raw({ type: '*/*' }), async (req, res) => {
  try {
    // Basic request hardening
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    // Signature verification
    const paystackSecret = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackSecret) {
      return res.status(500).send('Missing PAYSTACK_SECRET_KEY');
    }

    const crypto = require('crypto');
    const sig = req.headers['x-paystack-signature'];
    if (!sig) {
      return res.status(400).send('Missing x-paystack-signature');
    }

    const rawBody = req.body instanceof Buffer ? req.body : Buffer.from(req.body || '');
    const expected = crypto
      .createHmac('sha512', paystackSecret)
      .update(rawBody)
      .digest('hex');

    if (expected !== sig) {
      return res.status(400).send('Invalid signature');
    }

    const payload = JSON.parse(rawBody.toString('utf8'));
    const event = payload.event;
    const data = payload.data || {};

    const reference = data.reference;
    const amount = data.amount; // in kobo
    const customerEmail = data.customer ? data.customer.email : null;

    // Basic validation
    if (!reference || !amount) {
      return res.status(400).send('Missing reference/amount');
    }

    const admin = require('firebase-admin');
    const db = admin.firestore();

    // Idempotency: record each reference once
    const paymentRefDoc = db.collection('payments').doc(reference);
    const existing = await paymentRefDoc.get();
    if (existing.exists) {
      return res.status(200).send('Already processed');
    }

    const amountToPlan = {
      25000: 'gold',
      35000: 'platinum',
      40000: 'platinum_star'
    };

    const plan = amountToPlan[amount] || null;

    if (!plan) {
      await paymentRefDoc.set({
        reference,
        event,
        amount,
        customerEmail,
        status: 'unmapped_amount',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        raw: payload
      });
      return res.status(200).send('Ignored: unmapped amount');
    }

    // Only activate on successful charge events
    const successEvents = new Set([
      'charge.success',
      'subscription.create',
      'subscription.success'
    ]);

    if (!successEvents.has(event)) {
      await paymentRefDoc.set({
        reference,
        event,
        amount,
        customerEmail,
        status: 'ignored_event',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        raw: payload
      });
      return res.status(200).send('Event ignored');
    }

    // Find user by email
    if (!customerEmail) {
      await paymentRefDoc.set({
        reference,
        event,
        amount,
        customerEmail,
        status: 'missing_customer_email',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        raw: payload
      });
      return res.status(200).send('Ignored: missing email');
    }

    const usersSnap = await db
      .collection('users')
      .where('email', '==', customerEmail)
      .limit(1)
      .get();

    if (usersSnap.empty) {
      await paymentRefDoc.set({
        reference,
        event,
        amount,
        customerEmail,
        status: 'user_not_found',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        raw: payload
      });
      return res.status(200).send('Ignored: user not found');
    }

    const userDoc = usersSnap.docs[0];
    const uid = userDoc.id;

    await db.collection('users').doc(uid).set({
      plan,
      isPaid: true,
      trialUsed: true,
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      paystackReference: reference,
      lastPaymentEvent: event,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // SECURITY: Do NOT grant admin custom claims from the Paystack webhook.
    // Admin privileges must be controlled explicitly via server/setAdminClaim.js for known admin UID(s).

    await paymentRefDoc.set({
      reference,
      event,
      amount,
      customerEmail,
      plan,
      status: 'processed',
      uid,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });

    return res.status(200).send('Webhook processed');
  } catch (err) {
    console.error('Webhook error:', err);
    return res.status(500).send('Webhook error');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Webhook server listening on port ${PORT}`);
});

