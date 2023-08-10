import * as dotenv from 'dotenv' // see https://github.com/motdotla/dotenv#how-do-i-use-dotenv-with-import
dotenv.config()

import { createLogger, format, transports } from 'winston';
import fs from "fs";
import _ from "lodash";
import graphite from "graphite";
import convertDailyData from "./convertDailyData.js";

const isWindows = process.platform === 'win32';
const client = graphite.createClient(`plaintext://${isWindows ? "host.docker.internal" : "172.17.0.1"}:${process.env.RELAY_PORT}/`);
const logger = createLogger({
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.DailyRotateFile({
      filename: `logs/dailyData/application-%DATE%.log`,
      auditFile: `logs/dailyData/audit.json`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ],
});

async function UploadJson(obj) {
  let twoDaysAgoTime = new Date(new Date().setDate(new Date().getDate() - 2)).getTime();

  _.forOwn(obj, (shardOrders, shard) => {
    obj[shard] = _.groupBy(shardOrders, (order) => order.resourceType);
  });

  const datedDailyReports = {};
  _.forEach(obj, (shardOrders, shardNumber) => {
    _.forOwn(shardOrders, (reports) => {
      _.forEach(reports, (report) => {
        const reportTime = new Date(report.date).getTime();
        if (reportTime < twoDaysAgoTime) {
          if (!datedDailyReports[reportTime]) datedDailyReports[reportTime] = {};
          if (!datedDailyReports[reportTime][shardNumber]) datedDailyReports[reportTime][shardNumber] = [];
          datedDailyReports[reportTime][shardNumber].push(report);
        }
      });
    });
  });

  _.forEach(datedDailyReports, (shardReports, reportTime) => {
    let json = JSON.stringify(shardReports);
    const time = Math.floor(reportTime);
    const fileName = `./dailyFiles/${time}.json`;

    try {
      const uploaded = JSON.parse(fs.readFileSync(`./dailyFiles/${time}.json`));
      const shards = Object.keys(uploaded);
      for (let i = 0; i < shards.length; i++) {
        const shard = shards[i];
        if (!shardReports[shard]) shardReports[shard] = uploaded[shard];
      }
      json = JSON.stringify(shardReports);
      if (process.env.RELAY_PORT) {
        const data = convertDailyData(shardReports);
        client.write({ "data.screeps.market": data }, time, function (err) {
          if (err) logger.error(err)
        });
      }
      fs.writeFileSync(fileName, json);
    } catch (error) {
      fs.writeFileSync(fileName, json);
    }
  });
}

export default function DailyData(
  shard,
  dailyShardsData,
  emptyDailyShardsData,
  marketData,
  currentTime
) {
  dailyShardsData[shard] = JSON.parse(marketData);
  logger.debug(`Received daily data from ${shard} at ${currentTime}`);

  let hasEmptyShard = false;
  _.forOwn(dailyShardsData, (shard) => {
    if (shard.length === 0) {
      hasEmptyShard = true;
    }
  });

  if (!hasEmptyShard) {
    UploadJson(dailyShardsData);
    dailyShardsData = _.clone(emptyDailyShardsData);
    logger.info(`All shards have daily data and uploaded it at ${currentTime}`);
  }

  return dailyShardsData;
}
