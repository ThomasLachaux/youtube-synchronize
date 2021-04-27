import axios from 'axios';
import config from './utils/config';
import { spawn } from 'child_process';
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
    console.log(`Downloading ${youtubeId}`);
    const youtubeDl = spawn('youtube-dl', [
      '--extract-audio',
      '--audio-format',
      'mp3',
      '-o',
      `${config.musicDirectory}/${folderName}/%(title)s.%(ext)s`,
      `https://youtube.com/watch?v=${youtubeId}`,
    ]);

    youtubeDl.stdout.on('data', (log) => console.log(log.toString()));
    youtubeDl.stderr.on('data', (log) => console.error(log.toString()));
    youtubeDl.on('error', (error) => console.error(error));
    youtubeDl.on('close', (code) => {
      if (code === 0) return resolve(undefined);

      return reject();
    });
  });

(async () => {
  await notifyHealthchecks('started');

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
  }

  await notifyHealthchecks('finished');
})().catch(async (error) => {
  console.error(error);
  await notifyHealthchecks('fail');
  process.exit(1);
});
