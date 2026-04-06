-- Currency Conversion - Exchange Rates Table

CREATE TABLE IF NOT EXISTS exchange_rates (
  base_currency text NOT NULL,
  target_currency text NOT NULL,
  rate numeric(18, 8) NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (base_currency, target_currency)
);

CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched_at ON exchange_rates(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_base ON exchange_rates(base_currency);
