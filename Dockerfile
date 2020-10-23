FROM node:alpine

WORKDIR /opt

COPY package.json yarn.lock ./
RUN yarn --production

COPY . .

CMD yarn start