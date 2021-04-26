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
    for (const liveItem of liveItems) {
      const storedItem = storedItems.find(
        (findItem) => findItem.id === liveItem.id
      );

      // Checks that the music exists and has been downloaded
      if (!storedItem)
        throw new Error(`${liveItem.title} was not found on disk`);

      // If the title has changed, rename it on the disk
      if (storedItem.title !== liveItem.title)
        await renameMusic(playlistSlug, storedItem.title, liveItem.title);
    }

    await saveFileIndex(playlistSlug, liveItems);

    const storedMusics = await listStoredMusics(playlistSlug);
    const deletedMusics = storedMusics.filter(
      (storedMusic) =>
        !liveItems.some((liveItem) => liveItem.title === storedMusic)
    );

    logger.warn(
      `${deletedMusics} musics were removed on the playlist but are still on disk`
    );
    deletedMusics.forEach((music) => logger.warn(music));
  }

  await notifyHealthchecks('finished');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
