import { ScreepsAPI } from "screeps-api";
import _ from "lodash";
import winston from "winston";
import detailedData from "./src/detailedData.js";
import dailyData from "./src/dailyData.js";

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
    await api.auth("PandaMaster", "Aut0wiel!"); // authenticate
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
