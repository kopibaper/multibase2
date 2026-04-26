# Emergency Admin Password Reset

## Overview

The `reset-admin-password.ts` script provides direct database-level password reset for emergency recovery scenarios when normal authentication flows are unavailable.

## When to Use

Use this script when:
- API is down or unreachable
- SMTP is not configured (email reset unavailable)
- Admin has lost access and no other admin exists
- 2FA is locked and cannot be reset via normal means

## Requirements

- Direct database access (SSH to VPS or local filesystem)
- Node.js environment with project dependencies installed
- Backend `.env` file configured with correct `DATABASE_URL`

## Usage

### Local Development

```bash
cd dashboard/backend
npm run reset-password admin@example.com NewSecurePass123!
```

### Production VPS

```bash
# SSH to server
ssh root@your-vps-ip

# Navigate to backend directory
cd /opt/multibase/dashboard/backend

# Run reset script
npm run reset-password admin@example.com NewSecurePass123!
```

### Direct Execution

```bash
npx tsx scripts/reset-admin-password.ts <email> <new-password>
```

## Security Features

1. **Password Validation**: Enforces minimum 8-character length
2. **Email Validation**: Verifies user exists before updating
3. **Session Revocation**: Automatically terminates all active sessions
4. **Token Cleanup**: Clears any pending password reset tokens
5. **Audit Trail**: Logs action with timestamp and user details

## Example Output

```
🔧 Emergency Password Reset
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Target: admin@example.com

🔐 Hashing new password...

✅ Password reset successful!

📋 User Details:
   Email:    admin@example.com
   Username: admin
   Role:     admin

🔒 Revoked 3 active session(s)

⚠️  Security Notes:
   - User must log in with the new password
   - All previous sessions have been terminated
   - Consider enabling 2FA after login
```

## Error Handling

### Database Not Found
```
❌ Database not found at: /path/to/multibase.db
   Make sure you are running this from the backend directory.
```
**Solution**: Navigate to `dashboard/backend` directory before running.

### User Not Found
```
❌ Password reset failed:
   User not found: admin@example.com
```
**Solution**: Verify email address is correct. List users with:
```bash
sqlite3 data/multibase.db "SELECT email, username, role FROM User;"
```

### Password Too Short
```
❌ Password reset failed:
   Password must be at least 8 characters
```
**Solution**: Use a stronger password meeting minimum length requirement.

## Alternative Methods

### Method 1: Direct SQLite (No Dependencies)

```bash
cd /opt/multibase/dashboard/backend

# Generate password hash
node -e "console.log(require('bcryptjs').hashSync('NewPassword123!', 10))"

# Update database
sqlite3 data/multibase.db
UPDATE User SET passwordHash = '<hash-from-above>' WHERE email = 'admin@example.com';
.quit
```

### Method 2: Prisma Console

```bash
cd /opt/multibase/dashboard/backend
npx tsx -e "
import prisma from './src/lib/prisma';
import bcrypt from 'bcryptjs';
const hash = await bcrypt.hash('NewPassword123!', 10);
await prisma.user.update({
  where: { email: 'admin@example.com' },
  data: { passwordHash: hash }
});
console.log('Password updated');
process.exit(0);
"
```

## Post-Reset Actions

After successful password reset:

1. **Test Login**: Verify new credentials work via dashboard
2. **Enable 2FA**: Navigate to Settings → Security → Two-Factor Authentication
3. **Review Sessions**: Check active sessions and revoke any suspicious ones
4. **Update Credentials**: Store new password in secure password manager
5. **Audit Logs**: Review audit logs for any unauthorized access attempts

## Integration with Deployment

The script is automatically available after installation:

```bash
# Installer sets up admin credentials
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_PASSWORD=SecureInitialPass123!

# If admin forgets password later
npm run reset-password admin@example.com NewSecurePass123!
```

## Troubleshooting

### Permission Denied

```bash
# Ensure database file is readable
chmod 644 data/multibase.db

# Ensure directory is accessible
chmod 755 data/
```

### Module Not Found

```bash
# Reinstall dependencies
npm ci

# Regenerate Prisma client
npx prisma generate
```

### Database Locked

```bash
# Check for running processes
ps aux | grep node

# Stop backend if running
pm2 stop multibase-backend

# Run reset script
npm run reset-password admin@example.com NewPass123!

# Restart backend
pm2 start multibase-backend
```

## See Also

- [Authentication Architecture](../docs/AUTHENTICATION.md)
- [Security Best Practices](../docs/SECURITY.md)
- [Troubleshooting Guide](../docs/TROUBLESHOOTING.md)
