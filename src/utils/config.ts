import * as dotenv from 'dotenv';

dotenv.config();

const config = {
  musicDirectory: process.env.MUSIC_DIRECTORY || 'music',
  healthcheck: {
    enabled: process.env.HEALTHCHECKS_ENABLED === 'true',
    id: process.env.HEALTHCHECK_ID,
    url: process.env.HEALTHCHECK_URL || 'https://hc-ping.com',
  },
  youtube: {
    apiKey: process.env.YOUTUBE_API_KEY,
    playlists: process.env.YOUTUBE_PLAYLISTS,
  },
};

/**
 * Checks the configuration to not have any empty configuration variable.
 *
 * @private
 * @param {object} config - Configuration variable.
 */
const checkConfiguration = (config: object, parentKey = 'env') => {
  // Foreach config key, checks if it has a non null value
  for (const [key, value] of Object.entries(config)) {
    // Defines the key that will be displayed in case of an error
    const currentKey = `${parentKey}.${key}`;

    // Checks if NaN if the value is a number
    if (typeof value === 'number' && Number.isNaN(value)) {
      throw new Error(`${currentKey} is not a number`);
    }
    // Checks, if the value is a string, that the length is not equals to 0
    if (typeof value === 'string' && value.length === 0) {
      throw new Error(`${currentKey} is not a empty`);
    }

    // If the variable is an object, checks below
    if (typeof value === 'object') {
      checkConfiguration(value, currentKey);
    }

    // And finally checks the value is not undefined
    if (value === undefined) {
      throw new Error(`${currentKey} is not a defined`);
    }
  }
};

checkConfiguration(config);

export default config;
