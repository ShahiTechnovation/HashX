-- Seed trusted counterparties for HashX V1
INSERT INTO counterparties (id, display_name, wallet_address, wallet_type, status, metadata)
VALUES 
  ('a0000000-0000-0000-0000-000000000001', 'Nexus Analytics Agent (Node #42)', '0x742d35Cc6634C0532925a3b844Bc454e4438f44e', 'EOA', 'ACTIVE', '{"notes":"Verified provider of HashKey Chain block-range telemetry reports"}'),
  ('a0000000-0000-0000-0000-000000000002', 'ShadowData Synthetics', '0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7', 'EOA', 'ACTIVE', '{"notes":"Telemetry supplier flagged for signature discrepancy test"}'),
  ('a0000000-0000-0000-0000-000000000003', 'Autonomous Treasury Agent alpha', '0x1234567890123456789012345678901234567890', 'EOA', 'ACTIVE', '{"notes":"HashX buyer bot executing automated digital procurement"}')
ON CONFLICT (wallet_address) DO NOTHING;

