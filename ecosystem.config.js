module.exports = {
  apps: [{
    name: 'multibase-backend',
    cwd: '/opt/multibase/dashboard/backend',
    script: 'dist/server.js',
    exec_mode: 'fork',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },
    autorestart: true,
    max_memory_restart: '512M',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '/opt/multibase/logs/backend-error.log',
    out_file: '/opt/multibase/logs/backend-out.log'
  }]
};
