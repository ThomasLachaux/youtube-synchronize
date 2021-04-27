import winston from 'winston';
import axios from 'axios';
import moment from 'moment';
import fs from 'fs';
import { getPlaylistSlug } from './youtubeApi';
import config from './config';

export const logger = winston.createLogger({
  level: 'silly',
  transports: [new winston.transports.Console()],
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message }) => `${moment().format('HH:mm:ss')} ${level}: ${message}`)
  ),
});

export const youtubeApi = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3',
});

const getIndexPath = (slug: string) => `${config.musicDirectory}/${slug}.json`;

export const loadFileIndex = async (slug: string): Promise<{ title: string; id: string }[]> => {
  logger.info(`Load ${slug} playlist`);

  const path = getIndexPath(slug);

  if (fs.existsSync(path)) {
    logger.verbose(`Load ${path} index file`);
    const file = await fs.promises.readFile(path);
    return JSON.parse(file.toString());
  }

  return [];
};

export const saveFileIndex = async (slug: string, ids: { title: string; id: string }[]) => {
  const path = getIndexPath(slug);
  logger.verbose(`Save ${path} index`);
  await fs.promises.writeFile(path, JSON.stringify(ids, null, 2));
};

export const notifyHealthchecks = async (status: 'started' | 'finished' | 'fail') => {
  const suffix = status === 'started' ? '' : status;

  if (config.healthcheck.enabled) {
    await axios.get(`${config.healthcheck.url}/${config.healthcheck.id}${suffix}`);
  } else {
    logger.warn('Skipping healthchecks');
  }
};

export const listStoredMusics = async (slug: string) => {
  const musics = await fs.promises.readdir(`${config.musicDirectory}/${slug}`);

  // Remove the .mp3 at the end for each music
  return musics.filter((music) => music.endsWith('.mp3')).map((music) => music.replace(/\.mp3$/, ''));
};

export const renameMusic = (slug: string, oldName: string, newName: string) => {
  logger.info(`[${slug}] Rename ${oldName} to ${newName}`);
  return fs.promises.rename(
    `${config.musicDirectory}/${slug}/${oldName}.mp3`,
    `${config.musicDirectory}/${slug}/${newName}.mp3`
  );
};
