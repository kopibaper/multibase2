// Prisma configuration
// Note: Using plain export instead of defineConfig() from 'prisma/config'
// to avoid esbuild-register module resolution issues with subpath exports.
// Prisma auto-reads .env from the project directory, so dotenv is unnecessary.
export default {
  schema: './prisma/schema.prisma',
};
