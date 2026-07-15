// PM2 ecosystem — NDAW WUNE Admin Dashboard
// Sur le VPS :  pm2 start ecosystem.config.js --env production
//               pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: "ndawwune-admin",
      script: ".next/standalone/server.js",
      cwd: __dirname,

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "512M",

      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
        // 127.0.0.1 : Nginx est le seul à accéder à ce port — pas d'exposition directe
        HOSTNAME: "127.0.0.1",
        // NEXT_PUBLIC_API_URL est compilé dans le bundle au moment du build (pas ici).
        // Il est lu depuis .env.production avant npm run build dans redeploy_admin.sh.
      },

      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      error_file: "~/.pm2/logs/ndawwune-admin-error.log",
      out_file:   "~/.pm2/logs/ndawwune-admin-out.log",
    },
  ],
};
