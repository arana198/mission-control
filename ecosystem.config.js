/**
 * PM2 Configuration for Mission Control
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 save
 *   pm2 startup
 */

module.exports = {
  apps: [
    {
      name: "mc-notify",
      script: "./scripts/notification-daemon.js",
      cwd: "/Users/arana/dev/arana198/mission-control",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "500M",
      env: {
        NODE_ENV: "production",
        CONVEX_URL: "http://localhost:3210",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "./logs/notifier-error.log",
      out_file: "./logs/notifier-out.log",
      merge_logs: true,
      autorestart: true,
      restart_delay: 3000,
    },
    {
      name: "mc-app",
      script: "npm",
      args: "run dev",
      cwd: "/Users/arana/dev/arana198/mission-control",
      instances: 1,
      exec_mode: "fork",
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      autorestart: true,
      restart_delay: 5000,
    },
  ],
};
