module.exports = {
  apps: [
    {
      name: "shopnow-api",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "500M",
      time: true,
      env_production: { NODE_ENV: "production", PORT: 5000 },
    },
  ],
};
