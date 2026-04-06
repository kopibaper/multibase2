-- Rollback: Stripe Webhooks

DROP TABLE IF EXISTS {{paymentsTable}} CASCADE;
