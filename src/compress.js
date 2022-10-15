/* eslint-disable no-underscore-dangle */
import fs from "fs";
import path from "path";
import _ from "lodash";

const orderRecentFiles = (dir) => {
  return fs
    .readdirSync(dir)
    .filter((file) => fs.lstatSync(path.join(dir, file)).isFile())
    .map((file) => ({ file, mtime: fs.lstatSync(path.join(dir, file)).mtime }))
    .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
};

export default function Compress(obj) {
  const dir = "./compressedFiles";
  const mostRecentFiles = orderRecentFiles(dir);
  for (
    let index = 0;
    index < Math.min(5 * 1000, mostRecentFiles.length);
    index += 1
  ) {
    const filePath = `${dir}/${mostRecentFiles[index].file}`;
    const data = fs.readFileSync(filePath, { encoding: "utf8", flag: "r" });
    const oldObj = JSON.parse(data);
    Object.entries(oldObj).forEach(([shard, shardOrders]) => {
      Object.entries(shardOrders).forEach(([resource, orders]) => {
        const objOrders = obj[shard][resource] ? obj[shard][resource] : [];
        orders
          .filter((o) => objOrders.map((i) => i.id).includes(o.id))
          .forEach((order) => {
            const newOrder = objOrders.find((o2) => o2.id === order.id);
            if (newOrder) {
              if (_.isEqual(newOrder, order)) {
                objOrders.splice(objOrders.indexOf(newOrder), 1);
              }
            }
          });
      });
    });
  }

  return obj;
}
