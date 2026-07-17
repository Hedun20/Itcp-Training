module.exports = {
  apps: [
    {
      name: 'itcp-training-api',
      cwd: '/opt/itcp-training',
      script: 'server/dist/server.js',
      interpreter: '/usr/bin/node',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      merge_logs: true,
      out_file: '/var/log/itcp-training/api-out.log',
      error_file: '/var/log/itcp-training/api-error.log',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
