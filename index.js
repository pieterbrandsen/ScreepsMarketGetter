import { ScreepsAPI } from "screeps-api";
import _ from "lodash";
import winston from "winston";
import detailedData from "./src/detailedData.js";
import dailyData from "./src/dailyData.js";
import fs from "fs";
import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
import express from 'express'

dotenv.config()
const app = express()
const port = 10000

app.get('/', (req, res) => {
  const lastDailyFile = fs.readdirSync('./dailyFiles').sort().reverse()[0];
  const lastCompleteFile = fs.readdirSync('./completeFiles').sort().reverse()[0];
  const now = new Date();
  
  const diffDailyDays = Math.ceil(Math.abs(parseInt(now.getTime()) - parseInt(lastDailyFile)) / (1000 * 60 * 60 * 24));
  const diffCompleteMinutes = Math.ceil(Math.abs(parseInt(now.getTime()) - parseInt(lastCompleteFile)) / (1000 * 60));

  const online = diffDailyDays < 5 && diffCompleteMinutes < 60;
  res.send(online)
})
app.listen(port, () => {
  console.log(`App listening at http://localhost:${port}`)
})

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "log.log" }),
  ],
});

(async function () {
  try {
    // Setup
    const api = new ScreepsAPI();
    await api.auth(process.env.SCREEPS_USERNAME, process.env.SCREEPS_PASSWORD); // authenticate
    await api.socket.connect(); // connect socket

    const emptyDetailedShardsData = {
      shard0: [],
      shard1: [],
      shard2: [],
      shard3: [],
    };
    let detailedShardsData = _.clone(emptyDetailedShardsData);

    const emptyDailyShardsData = {
      shard0: [],
      shard1: [],
      shard2: [],
      shard3: [],
    };
    let dailyShardsData = _.clone(emptyDailyShardsData);
    api.socket.subscribe("console", (event) => {
      const data = event.data;
      const currentTime = Date.now();
      if (!data || !event.data.messages || event.data.messages.log.length === 0)
        return;

      const detailedMarketData = event.data.messages.log.find((message) =>
        message.startsWith('[{"created')
      );
      if (detailedMarketData)
        detailedShardsData = detailedData(
          data.shard,
          detailedShardsData,
          emptyDetailedShardsData,
          detailedMarketData,
          currentTime
        );
      const dailyMarketData = event.data.messages.log.find((message) =>
        message.startsWith('[{"resourceType')
      );
      if (dailyMarketData)
        dailyShardsData = dailyData(
          data.shard,
          dailyShardsData,
          emptyDailyShardsData,
          dailyMarketData,
          currentTime
        );
    });
  } catch (error) {
    logger.error(error);
  }
})();
