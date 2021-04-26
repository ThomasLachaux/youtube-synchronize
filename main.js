const Youtube = require("simple-youtube-api");
const fs = require("fs");
const axios = require("axios");
const { spawn } = require("child_process");

require("dotenv").config();

const subdirectory = "music";

const youtubeClient = new Youtube(process.env.API_KEY);

const downloadVideo = (youtubeId, folderName) =>
  new Promise((resolve, reject) => {
    console.log(`Downloading ${youtubeId}`);
    const youtubeDl = spawn("youtube-dl", [
      "--extract-audio",
      "--audio-format",
      "mp3",
      "-o",
      `${subdirectory}/${folderName}/%(title)s.%(ext)s`,
      `https://youtube.com/watch?v=${youtubeId}`,
    ]);

    youtubeDl.stdout.on("data", (log) => console.log(log.toString()));
    youtubeDl.stderr.on("data", (log) => console.error(log.toString()));
    youtubeDl.on("error", (error) => console.error(error));
    youtubeDl.on("close", (code) => {
      if (code === 0) return resolve();

      return reject();
    });
  });

(async () => {
  // Tell healthchecks the task has started
  await axios.get(`https://hc-ping.com/${process.env.HEALTHCHECK_ID}/start`);
  const playlistIds = process.env.PLAYLIST_IDS.split(",");

  for (const playlistId of playlistIds) {
    const playlist = await youtubeClient.getPlaylistByID(playlistId);

    console.log(`Playlist ${playlist.title}`);

    const slug = playlist.title.toLowerCase();
    const filename = `${subdirectory}/${slug}.json`;

    let fileVideos = null;
    if (fs.existsSync(filename)) {
      const file = await fs.promises.readFile(filename);
      fileVideos = JSON.parse(file);
    } else {
      fileVideos = [];
    }

    const playlistItems = await playlist.getVideos();
    const liveVideos = playlistItems.map((video) => video.id);

    const newVideos = liveVideos.filter((video) => !fileVideos.includes(video));

    console.log(`${newVideos.length} new videos to download`);

    for (const video of newVideos) {
      await downloadVideo(video, slug);
    }

    await fs.promises.writeFile(filename, JSON.stringify(liveVideos));
  }

  // Tell Healthchecks the task has ended
  await axios.get(`https://hc-ping.com/${process.env.HEALTHCHECK_ID}`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
