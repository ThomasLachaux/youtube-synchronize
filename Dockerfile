FROM node:alpine

WORKDIR /opt

RUN apk update && apk add youtube-dl

COPY package.json yarn.lock ./
RUN yarn --production

COPY . .

CMD yarn start