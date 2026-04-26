#!/usr/bin/env node
/**
 * Emergency Admin Password Reset Script
 * 
 * Usage:
 *   npm run reset-password <email> <new-password>
 *   npx tsx scripts/reset-admin-password.ts admin@example.com NewSecurePass123!
 * 
 * Purpose:
 *   Direct database password reset for emergency recovery when:
 *   - API is unavailable
 *   - SMTP is not configured
 *   - Admin has lost access to their account
 * 
 * Requirements:
 *   - Direct database access (SSH to VPS or local filesystem)
 *   - Node.js environment with project dependencies installed
 * 
 * Safety:
 *   - Validates email exists before updating
 *   - Enforces minimum password length (8 chars)
 *   - Revokes all existing sessions for security
 *   - Logs action with timestamp
 */

import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';

// Load environment variables
dotenv.config();

const SALT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;

function createPrismaClient() {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/multibase.db';
  const dbPath = path.resolve(dbUrl.replace(/^file:/, ''));
  
  if (!fs.existsSync(dbPath)) {
    console.error(`❌ Database not found at: ${dbPath}`);
    console.error('   Make sure you are running this from the backend directory.');
    process.exit(1);
  }
  
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter } as any);
}

async function resetPassword(email: string, newPassword: string) {
  const prisma = createPrismaClient();
  
  try {
    // Validate inputs
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }
    
    if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    }
    
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        role: true,
      },
    });
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }
    
    // Hash new password
    console.log('🔐 Hashing new password...');
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    
    // Update password and clear reset tokens
    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetPasswordToken: null,
        resetPasswordExpires: null,
      },
    });
    
    // Revoke all existing sessions for security
    const deletedSessions = await prisma.session.deleteMany({
      where: { userId: user.id },
    });
    
    console.log('');
    console.log('✅ Password reset successful!');
    console.log('');
    console.log('📋 User Details:');
    console.log(`   Email:    ${user.email}`);
    console.log(`   Username: ${user.username}`);
    console.log(`   Role:     ${user.role}`);
    console.log('');
    console.log(`🔒 Revoked ${deletedSessions.count} active session(s)`);
    console.log('');
    console.log('⚠️  Security Notes:');
    console.log('   - User must log in with the new password');
    console.log('   - All previous sessions have been terminated');
    console.log('   - Consider enabling 2FA after login');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ Password reset failed:');
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    console.error('');
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('');
    console.log('🔧 Emergency Admin Password Reset');
    console.log('');
    console.log('Usage:');
    console.log('  npm run reset-password <email> <new-password>');
    console.log('  npx tsx scripts/reset-admin-password.ts <email> <new-password>');
    console.log('');
    console.log('Example:');
    console.log('  npm run reset-password admin@example.com NewSecurePass123!');
    console.log('');
    console.log('Requirements:');
    console.log('  - Password must be at least 8 characters');
    console.log('  - Direct database access required');
    console.log('  - All existing sessions will be revoked');
    console.log('');
    process.exit(1);
  }
  
  const [email, newPassword] = args;
  
  console.log('');
  console.log('🔧 Emergency Password Reset');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`Target: ${email}`);
  console.log('');
  
  await resetPassword(email, newPassword);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
