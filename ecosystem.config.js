// PM2 ecosystem — NDAW WUNE Admin Dashboard
// Sur le VPS, lancez : pm2 start ecosystem.config.js
// Puis pour sauvegarder : pm2 save && pm2 startup

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
        HOSTNAME: "0.0.0.0",
        // Remplacer par l'URL réelle du backend sur le VPS
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1",
      },

      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/ndawwune-admin-error.log",
      out_file: "/var/log/pm2/ndawwune-admin-out.log",
      merge_logs: true,
    },
  ],
};
