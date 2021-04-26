import axios from 'axios';
import config from './utils/config';
import { spawn } from 'child_process';
import { getPlaylistSlug, getVideosByPlaylist } from './utils/youtubeApi';
import {
  loadFileIndex,
  logger,
  notifyHealthchecks,
  saveFileIndex,
} from './utils/helpers';

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
    const playlistItems = await getVideosByPlaylist(playlistId);
    const liveIds = playlistItems.map((item) => item.id);
    const storedIds = await loadFileIndex(playlistSlug);

    const newVideos = liveIds.filter((id) => !storedIds.includes(id));

    logger.info(`${newVideos.length} new videos to download`);

    for (const video of newVideos) {
      await downloadVideo(video, playlistSlug);
    }

    await saveFileIndex(playlistSlug, liveIds);
  }

  await notifyHealthchecks('finished');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
