-- Add email_verifications table for 2FA login security
CREATE TABLE IF NOT EXISTS email_verifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  email VARCHAR NOT NULL,
  code_hash VARCHAR NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  attempt_count INTEGER DEFAULT 0,
  last_sent_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS IDX_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS IDX_email_verifications_status ON email_verifications(status);

-- Add comment explaining the table purpose
COMMENT ON TABLE email_verifications IS 'Stores email verification codes for 2FA login security (10-minute expiry, 3 attempt limit)';
