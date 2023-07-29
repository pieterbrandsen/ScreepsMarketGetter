import fs from "fs";
import compressor from "./compress.js";
import _ from "lodash";
import winston from "winston";

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new transports.DailyRotateFile({
      filename: `logs/detailedData/application-%DATE%.log`,
      auditFile: `logs/detailedData/audit.json`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d'
    })
  ],
});

async function UploadJson(obj, currentTime) {
  _.forOwn(obj, (shardOrders, shard) => {
    obj[shard] = _.groupBy(shardOrders, (order) => order.resourceType);
  });

  let json = JSON.stringify(obj);
  fs.writeFileSync(`./completeFiles/${Math.floor(currentTime)}.json`, json);

  // json = JSON.stringify(compressor(obj));
  // fs.writeFileSync(`./compressedFiles/${Math.floor(currentTime)}.json`, json);
}

export default function DetailedData(
  shard,
  detailedShardsData,
  emptyDetailedShardsData,
  marketData,
  currentTime
) {
  detailedShardsData[shard] = JSON.parse(marketData);
  logger.debug(`Received detailed data from ${shard} at ${currentTime}`);

  let hasEmptyShard = false;
  _.forOwn(detailedShardsData, (shard) => {
    if (shard.length === 0) {
      hasEmptyShard = true;
    }
  });

  if (!hasEmptyShard) {
    UploadJson(detailedShardsData, currentTime);
    detailedShardsData = _.clone(emptyDetailedShardsData);
    logger.info(
      `All shards have detailed data and uploaded it at ${currentTime}`
    );
  }

  return detailedShardsData;
}
