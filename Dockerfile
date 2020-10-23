FROM node:alpine

WORKDIR /opt

RUN apk update && apk add py3-pip && pip3 install youtube-dl

COPY package.json yarn.lock ./
RUN yarn --production

COPY . .

CMD yarn start