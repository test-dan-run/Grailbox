import { Config } from '@remotion/cli/config';

// Google Play plays the YouTube upload, so encode for quality rather than size.
Config.setVideoImageFormat('jpeg');
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
Config.setOverwriteOutput(true);
