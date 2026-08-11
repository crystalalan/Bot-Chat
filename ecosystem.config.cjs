export default {
  apps: [
    {
      name: 'bot-chat',
      script: 'src/index.js',
      interpreter: 'node',
      instances: 1,
      autorestart: true,
      max_restarts: 20,
      restart_delay: 5000,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
      },
      out_file: './logs/bot.out.log',
      error_file: './logs/bot.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
