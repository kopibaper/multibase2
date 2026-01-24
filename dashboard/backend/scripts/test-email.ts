import EmailService from '../src/services/EmailService';

const targetEmail = process.argv[2];

if (!targetEmail) {
  console.error('Usage: npx ts-node scripts/test-email.ts <target-email>');
  process.exit(1);
}

async function test() {
  console.log(`Sending test email to ${targetEmail}...`);

  // Test Verification Email
  const result = await EmailService.sendVerificationEmail(
    targetEmail,
    'test-token-123',
    'TestUser'
  );

  if (result) {
    console.log('✅ Test email sent successfully.');
  } else {
    console.error('❌ Failed to send test email. Check your .env configuration.');
    console.error('Ensure SMTP_HOST, SMTP_USER, SMTP_PASS are set.');
  }
}

test();
