# Screeps market getter

A service which connects to the console socket where daily totals and/or current orders will be logged to files.

# Configuration

Copy and rename `.env.example` to `.env`, fill in according to your needs.

# Running

1. Log in each shard the required data, like `console.log(Game.market.getHistory())`
2. `docker-compose up -d` or `npm start`
