import { Request, Response } from 'express';
import crypto from 'crypto';
import { AuthenticatedRequest } from '../middleware/auth';
import { Subscription, User } from '../models';
import { notificationService } from '../services/notification.service';
import {
  BillablePlan,
  buildSubscriptionPayload,
  effectivePlanForStatus,
  ensureSubscription,
  isBillablePlan,
  isCheckoutPlan,
  isValidMongoId,
  mapStripeStatus,
  planLimits,
  stripeConfigured,
} from '../utils/billing';

const getStripePriceId = (plan: 'pro' | 'team') => {
  if (plan === 'pro') return process.env.STRIPE_PRO_PRICE_ID;
  return process.env.STRIPE_TEAM_PRICE_ID;
};

const safeServerError = (res: Response, code: string) => res.status(500).json({
  error: 'An unexpected subscription API error occurred.',
  code,
});

const safeStripeError = (res: Response, code: string, status = 502) => res.status(status).json({
  error: 'Billing provider request failed. Please try again later.',
  code,
});

const safeFrontendUrl = (path: string) => {
  const configured = process.env.FRONTEND_URL || 'http://localhost:3000';
  try {
    const base = new URL(configured);
    return new URL(path, base.origin).toString();
  } catch {
    return `http://localhost:3000${path}`;
  }
};

const isStripeId = (value: unknown, prefix?: string): value is string => (
  typeof value === 'string' &&
  value.length <= 255 &&
  /^[A-Za-z0-9_]+$/.test(value) &&
  (!prefix || value.startsWith(prefix))
);

const syncSubscriptionPlan = async ({
  userId,
  plan,
  stripeCustomerId,
  stripeSubscriptionId,
  status = 'active',
  stripeEventId,
  stripeEventCreated,
}: {
  userId: string;
  plan: BillablePlan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  status?: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'trialing';
  stripeEventId?: string;
  stripeEventCreated?: number;
}) => {
  if (!isValidMongoId(userId)) return null;

  const current = await ensureSubscription(userId);
  if (stripeEventId && current.stripeProcessedEventIds?.includes(stripeEventId)) {
    return current;
  }

  const eventDate = stripeEventCreated ? new Date(stripeEventCreated * 1000) : new Date();
  if (current.stripeUpdatedAt && eventDate < current.stripeUpdatedAt) {
    if (stripeEventId) {
      current.stripeProcessedEventIds = [...(current.stripeProcessedEventIds || []), stripeEventId].slice(-50);
      await current.save();
    }
    return current;
  }

  const effectivePlan = effectivePlanForStatus(plan, status);
  const subscription = await Subscription.findOneAndUpdate(
    { userId },
    {
      $set: {
        plan,
        limits: planLimits[effectivePlan],
        status,
        renewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isLocalSimulation: false,
        stripeUpdatedAt: eventDate,
        ...(stripeCustomerId ? { stripeCustomerId } : {}),
        ...(stripeSubscriptionId ? { stripeSubscriptionId } : {}),
      },
      ...(stripeEventId ? { $addToSet: { stripeProcessedEventIds: stripeEventId } } : {}),
      $setOnInsert: {
        userId,
      },
    },
    { new: true, upsert: true }
  );

  await User.findByIdAndUpdate(userId, { plan: effectivePlan });
  await notificationService.create({
    userId,
    title: 'تم تحديث الاشتراك',
    message: `تم تحديث خطة حسابك إلى ${effectivePlan.toUpperCase()} وحالة الاشتراك إلى ${status}.`,
    type: effectivePlan === 'free' ? 'info' : 'success',
    link: '/billing',
  });
  return subscription;
};

export const getSubscription = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    return res.status(200).json(await buildSubscriptionPayload(req.user.id));
  } catch {
    return safeServerError(res, 'SUBSCRIPTION_READ_FAILED');
  }
};

export const createCheckoutSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });

    const { plan } = req.body as { plan?: unknown };
    if (!isCheckoutPlan(plan)) {
      return res.status(400).json({
        error: 'Stripe checkout supports pro or team plans.',
        code: 'INVALID_PLAN',
      });
    }

    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const priceId = getStripePriceId(plan);
    if (!stripeSecret || !priceId) {
      return res.status(501).json({
        error: 'Stripe is not configured for this environment.',
        code: 'STRIPE_NOT_CONFIGURED',
        stripeConfigured: false,
        isLocalSimulation: true,
      });
    }

    const body = new URLSearchParams({
      mode: 'subscription',
      success_url: safeFrontendUrl('/billing?checkout=success'),
      cancel_url: safeFrontendUrl('/billing?checkout=cancelled'),
      client_reference_id: req.user.id,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'metadata[userId]': req.user.id,
      'metadata[plan]': plan,
      'subscription_data[metadata][userId]': req.user.id,
      'subscription_data[metadata][plan]': plan,
    });

    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.url !== 'string') {
      return safeStripeError(res, 'STRIPE_CHECKOUT_FAILED');
    }

    return res.status(200).json({ checkoutUrl: data.url, sessionId: data.id, stripeConfigured: true });
  } catch {
    return safeServerError(res, 'SUBSCRIPTION_CHECKOUT_FAILED');
  }
};

export const createBillingPortalSession = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized.' });
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    const subscription = await ensureSubscription(req.user.id);
    if (!stripeSecret) {
      return res.status(501).json({
        error: 'Stripe is not configured for this environment.',
        code: 'STRIPE_NOT_CONFIGURED',
        stripeConfigured: false,
        isLocalSimulation: true,
      });
    }
    if (!subscription.stripeCustomerId || !isStripeId(subscription.stripeCustomerId, 'cus_')) {
      return res.status(404).json({
        error: 'No Stripe billing account is available for this user.',
        code: 'BILLING_CUSTOMER_NOT_FOUND',
      });
    }

    const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        customer: subscription.stripeCustomerId,
        return_url: safeFrontendUrl('/billing'),
      }),
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || typeof data.url !== 'string') {
      return safeStripeError(res, 'STRIPE_PORTAL_FAILED');
    }
    return res.status(200).json({ portalUrl: data.url });
  } catch {
    return safeServerError(res, 'SUBSCRIPTION_PORTAL_FAILED');
  }
};

const verifyStripeSignature = (rawBody: Buffer, signature: string, webhookSecret: string) => {
  const timestamp = signature.split(',').find((part) => part.startsWith('t='))?.slice(2);
  const provided = signature.split(',').find((part) => part.startsWith('v1='))?.slice(3);
  if (!timestamp || !provided) return false;
  const signedPayload = `${timestamp}.${rawBody.toString('utf8')}`;
  const expected = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex');
  return (
    Buffer.byteLength(expected) === Buffer.byteLength(provided) &&
    crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided))
  );
};

export const stripeWebhook = async (req: Request, res: Response) => {
  try {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    const signature = req.header('stripe-signature');

    if (!webhookSecret || !signature) {
      return res.status(400).json({ error: 'Stripe webhook signature is invalid.', code: 'WEBHOOK_SIGNATURE_INVALID' });
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
    if (!verifyStripeSignature(rawBody, signature, webhookSecret)) {
      return res.status(400).json({ error: 'Stripe webhook signature is invalid.', code: 'WEBHOOK_SIGNATURE_INVALID' });
    }

    let event: any;
    try {
      event = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Stripe webhook payload is invalid.', code: 'WEBHOOK_PAYLOAD_INVALID' });
    }

    if (!isStripeId(event.id, 'evt_')) {
      return res.status(400).json({ error: 'Stripe webhook event is invalid.', code: 'WEBHOOK_EVENT_INVALID' });
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object || {};
      const userId = session.metadata?.userId || session.client_reference_id;
      const plan = session.metadata?.plan;
      if (isValidMongoId(userId) && isCheckoutPlan(plan)) {
        await syncSubscriptionPlan({
          userId,
          plan,
          stripeCustomerId: isStripeId(session.customer, 'cus_') ? session.customer : undefined,
          stripeSubscriptionId: isStripeId(session.subscription, 'sub_') ? session.subscription : undefined,
          status: 'active',
          stripeEventId: event.id,
          stripeEventCreated: event.created,
        });
      }
    } else if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const stripeSubscription = event.data?.object || {};
      const subscriptionId = stripeSubscription.id;
      if (isStripeId(subscriptionId, 'sub_')) {
        const existing = await Subscription.findOne({ stripeSubscriptionId: subscriptionId });
        if (existing) {
          const plan = isBillablePlan(existing.plan) ? existing.plan : 'free';
          const status = event.type === 'customer.subscription.deleted'
            ? 'canceled'
            : mapStripeStatus(stripeSubscription.status);
          await syncSubscriptionPlan({
            userId: existing.userId.toString(),
            plan,
            status,
            stripeSubscriptionId: subscriptionId,
            stripeCustomerId: isStripeId(stripeSubscription.customer, 'cus_') ? stripeSubscription.customer : existing.stripeCustomerId,
            stripeEventId: event.id,
            stripeEventCreated: event.created,
          });
        }
      }
    }

    return res.status(200).json({ received: true });
  } catch {
    return res.status(400).json({ error: 'Stripe webhook could not be processed.', code: 'WEBHOOK_PROCESSING_FAILED' });
  }
};
