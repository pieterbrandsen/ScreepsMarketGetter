import fs from "fs";
import _ from "lodash";

function UploadJson(obj, currentTime) {
  _.forOwn(obj, (shardOrders, shard) => {
    obj[shard] = _.groupBy(shardOrders, (order) => order.resourceType);
  });

  let json = JSON.stringify(obj);
  const roundedTime = new Date(Math.floor(currentTime / (15 * 60 * 1000)) * (15 * 60 * 1000));
  fs.writeFileSync(`./completeFiles/${Math.floor(roundedTime)}.json`, json);
}

export default function DetailedData(
  shard,
  detailedShardsData,
  emptyDetailedShardsData,
  marketData,
  currentTime
) {
  detailedShardsData[shard] = JSON.parse(marketData);

  let hasEmptyShard = false;
  _.forOwn(detailedShardsData, (shard) => {
    if (shard.length === 0) {
      hasEmptyShard = true;
    }
  });

  if (!hasEmptyShard) {
    UploadJson(detailedShardsData, currentTime);
    detailedShardsData = _.clone(emptyDetailedShardsData);
  }

  return detailedShardsData;
}
