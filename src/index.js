import 'dotenv/config'
import 'winston-daily-rotate-file';
import { ScreepsAPI } from "screeps-api";
import _ from "lodash";
import { createLogger, format, transports } from 'winston';
import detailedData from "./market/detailedData.js";
import dailyData from "./market/dailyData.js";
import fs from "fs";
import express from 'express'
import cron from 'node-cron';
import screepsAPI from 'screeps-advanced-api';
import graphite from "graphite";

const client = graphite.createClient(`plaintext://host.docker.internal:${process.env.RELAY_PORT}/`);

const app = express()
const port = process.env.PORT

const emptyShardsData = {
    shard0: [],
    shard1: [],
    shard2: [],
    shard3: [],
};

let detailedShardsData = {}
let dailyShardsData = {}

app.get('/', (req, res) => {
    const lastDailyFile = fs.readdirSync('./dailyFiles').sort().reverse()[0];
    const lastCompleteFile = fs.readdirSync('./completeFiles').sort().reverse()[0];
    const now = new Date();

    const diffDailyDays = Math.ceil(Math.abs(parseInt(now.getTime()) - parseInt(lastDailyFile)) / (1000 * 60 * 60 * 24));
    const diffCompleteMinutes = Math.ceil(Math.abs(parseInt(now.getTime()) - parseInt(lastCompleteFile)) / (1000 * 60));

    const online = diffDailyDays < 10 && diffCompleteMinutes < 600;
    const statusDetailedShards = {}
    const statusDailyShards = {};
    const shardNames = Object.keys(emptyShardsData);
    for (let s = 0; s < shardNames.length; s += 1) {
        const shardName = shardNames[s];
        statusDailyShards[shardName] = dailyShardsData[shardName] ? dailyShardsData[shardName].length : undefined;
        statusDetailedShards[shardName] = detailedShardsData[shardName] ? detailedShardsData[shardName].length : undefined;
    }
    res.send({ result: online, lastDailyFile, lastCompleteFile, diffDailyDays, diffCompleteMinutes, detailedShardsData: statusDetailedShards, dailyShardsData: statusDailyShards })
})
app.listen(port, () => {
    console.log(`App listening at http://localhost:${port}`)
})

const logger = createLogger({
    format: format.combine(
        format.timestamp(),
        format.json()
    ),
    transports: [
        new transports.DailyRotateFile({
            filename: `logs/application-%DATE%.log`,
            auditFile: `logs/audit.json`,
            datePattern: 'YYYY-MM-DD',
            zippedArchive: true,
            maxSize: '20m',
            maxFiles: '14d'
        })
    ],
});

(async function () {
    try {
        const api = new ScreepsAPI();
        await api.auth(process.env.SCREEPS_USERNAME, process.env.SCREEPS_PASSWORD);
        await api.socket.connect();

        detailedShardsData = _.clone(emptyShardsData);
        dailyShardsData = _.clone(emptyShardsData);
        api.socket.subscribe("console", (event) => {
            const data = event.data;
            const currentTime = Date.now();
            if (!data || !event.data.messages || event.data.messages.log.length === 0)
                return;

            const detailedMarketData = event.data.messages.log.find((message) =>
                message.startsWith('[{"created')
            );
            if (detailedMarketData) {
                detailedShardsData = detailedData(
                    data.shard,
                    detailedShardsData,
                    emptyShardsData,
                    detailedMarketData,
                    currentTime
                );
                logger.info(`Detailed data for shard ${data.shard} received`);
            }

            const dailyMarketData = event.data.messages.log.find((message) =>
                message.startsWith('[{"resourceType')
            );
            if (dailyMarketData) {
                dailyShardsData = dailyData(
                    data.shard,
                    dailyShardsData,
                    emptyShardsData,
                    dailyMarketData,
                );
                logger.info(`Daily data for shard ${data.shard} received`);
            }
        });
    } catch (error) {
        logger.error(error);
    }
})();

async function writeLeaderboard() {
    try {
        logger.info('\r\Pull leaderboard event hit: ', new Date());
        const api = new screepsAPI(process.env.SCREEPS_TOKEN);
        const leaderboard = await api.getAllUsers();
        const users = {};
        for (let i = 0; i < leaderboard.length; i += 1) {
            const user = leaderboard[i];
            users[user.username] = user;
        }
        client.write({ "data.screeps.leaderboard": users }, function (err) { });
    } catch (error) {
        logger.error(error);
    }
}

// cron.schedule('0 */6 * * *', async () => {
//     await writeLeaderboard();
// });
writeLeaderboard();