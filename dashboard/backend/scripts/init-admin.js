const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createInitialAdmin() {
  try {
    // Check if any user exists
    const existingUser = await prisma.user.findFirst();

    if (existingUser) {
      console.log('ℹ️  Users already exist. Skipping initialization.');
      return;
    }

    // Create admin user — credentials from env vars (set by installer) or defaults
    const password = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123';
    const email = process.env.DEFAULT_ADMIN_EMAIL || 'admin@multibase.local';
    const username = process.env.DEFAULT_ADMIN_USERNAME || 'admin';
    const passwordHash = await bcrypt.hash(password, 10);

    const admin = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        role: 'admin',
      },
    });

    console.log('✅ Initial admin user created successfully!');
    console.log('');
    console.log(`📧 Email: ${email}`);
    console.log(`👤 Username: ${username}`);
    console.log(`🔑 Password: ${password}`);
    console.log('');
    console.log('⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createInitialAdmin()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
