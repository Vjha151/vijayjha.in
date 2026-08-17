module.exports = {
  apps: [{
    name: "vijayjha",
    script: "server.mjs",
    env_production: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
};
