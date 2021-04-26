import winston from 'winston';
import axios from 'axios';
import moment from 'moment';
import fs from 'fs';
import { getPlaylistSlug } from './youtubeApi';
import config from './config';

export const logger = winston.createLogger({
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(
      ({ level, message }) =>
        `${moment().format('HH:mm:ss')} ${level}: ${message}`
    )
  ),
});

export const youtubeApi = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3',
});

const getIndexPath = (slug: string) => `${config.musicDirectory}/${slug}.json`;

export const loadFileIndex = async (slug: string): Promise<string[]> => {
  logger.info(`Load ${slug} playlist`);

  const path = getIndexPath(slug);

  if (fs.existsSync(path)) {
    logger.verbose(`Load ${path} index file`);
    const file = await fs.promises.readFile(path);
    return JSON.parse(file.toString());
  }

  return [];
};

export const saveFileIndex = async (slug: string, ids: string[]) => {
  const path = getIndexPath(slug);
  logger.verbose(`Save ${path} index`);
  await fs.promises.writeFile(path, JSON.stringify(ids, null, 2));
};

export const notifyHealthchecks = async (status: 'started' | 'finished') => {
  if (config.healthcheck.enabled) {
    await axios.get(
      `${config.healthcheck.url}/${config.healthcheck.id}${
        status === 'started' ? '/start' : ''
      }`
    );
  } else {
    logger.warn('Skipping healthchecks');
  }
};
