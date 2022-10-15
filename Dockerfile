# syntax=docker/dockerfile:1

FROM node:16.7.0
ENV NODE_ENV=production

WORKDIR /usr/screepsmarket
RUN mkdir compressedFiles
RUN mkdir completeFiles
RUN mkdir dailyFiles
COPY . .

RUN npm install --production

CMD [ "node", "fm.js" ]