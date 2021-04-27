import axios from 'axios';
import config from './utils/config';
import { spawn } from 'child_process';
import recursive from 'recursive-readdir';
import { getPlaylistSlug, getVideosByPlaylist } from './utils/youtubeApi';
import {
  listStoredMusics,
  loadFileIndex,
  logger,
  notifyHealthchecks,
  renameMusic,
  saveFileIndex,
} from './utils/helpers';
import fs from 'fs';

const downloadVideo = (youtubeId: string, folderName: string) =>
  new Promise((resolve, reject) => {
    logger.verbose(`Downloading ${youtubeId}`);
    const youtubeDl = spawn('youtube-dl', [
      '--extract-audio',
      '--audio-format',
      'mp3',
      '-o',
      `${config.musicDirectory}/${folderName}/%(title)s.%(ext)s`,
      `https://youtube.com/watch?v=${youtubeId}`,
    ]);

    youtubeDl.stdout.on('data', (log) => logger.verbose(log.toString()));
    youtubeDl.stderr.on('data', (log) => logger.error(log.toString()));
    youtubeDl.on('error', (error) => logger.error(error));
    youtubeDl.on('close', (code) => {
      if (code === 0) return resolve(undefined);

      return reject();
    });
  });

(async () => {
  await notifyHealthchecks('start');

  // Foreach playlists
  for (const playlistId of config.youtube.playlists.split(',')) {
    // Fetch the playlist from the Youtube API
    const playlistSlug = await getPlaylistSlug(playlistId);

    const liveItems = await getVideosByPlaylist(playlistId);
    const liveIds = liveItems.map((item) => item.id);

    const storedItems = await loadFileIndex(playlistSlug);
    const storedIds = storedItems.map((item) => item.id);

    const newVideos = liveIds.filter((id) => !storedIds.includes(id));

    logger.info(`${newVideos.length} new videos to download`);

    for (const video of newVideos) {
      await downloadVideo(video, playlistSlug);
    }

    // Checks if the title hasn't changed
    for (const storedItem of storedItems) {
      const liveItem = liveItems.find((findItem) => findItem.id === storedItem.id);

      // If the title has changed, rename it on the disk
      if (liveItem && liveItem.title !== storedItem.title)
        await renameMusic(playlistSlug, storedItem.title, liveItem.title);
    }

    await saveFileIndex(playlistSlug, liveItems);

    // Checks if there are any duplicates
    const duplicates = liveItems.filter((item, index) => liveItems.indexOf(item) !== index);
    if (duplicates.length > 0) {
      logger.warn(`Duplicate musics exists in the playlist !`);
      duplicates.forEach((item) => logger.warn(`[Duplicate] ${item.title}`));
    }
  }

  const files = await recursive(config.musicDirectory);
  const musics = files.reduce((previous, current) => {
    const match = current.match(/[^/]+\.mp3$/);

    if (match) {
      return [...previous, match[0]];
    }

    return previous;
  }, []);

  const duplicates = musics.filter((item, index) => musics.indexOf(item) !== index);
  if (duplicates.length > 0) {
    logger.warn(`Duplicate musics exists between playlists !`);
    duplicates.forEach((item) => logger.warn(`[Duplicate] ${item}`));
  }

  await notifyHealthchecks('finished');
})().catch(async (error) => {
  console.error(error);
  await notifyHealthchecks('fail');
  process.exit(1);
});
