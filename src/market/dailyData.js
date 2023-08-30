import fs from "fs";
import _ from "lodash";
import graphite from "graphite";
import convertDailyData from "./convertDailyData.js";

const client = graphite.createClient(`plaintext://host.docker.internal:${process.env.RELAY_PORT}/`);

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
) {
  dailyShardsData[shard] = JSON.parse(marketData);

  let hasEmptyShard = false;
  _.forOwn(dailyShardsData, (shard) => {
    if (shard.length === 0) {
      hasEmptyShard = true;
    }
  });

  if (!hasEmptyShard) {
    UploadJson(dailyShardsData);
    dailyShardsData = _.clone(emptyDailyShardsData);
  }

  return dailyShardsData;
}
