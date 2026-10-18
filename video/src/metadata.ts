import { ALL_FORMATS, Input, UrlSource } from 'mediabunny';
import { getStaticFiles, staticFile, type CalculateMetadataFunction } from 'remotion';

import { FPS, HOLD_END, OUTRO_SECONDS, SCENES, TRANSITION_SECONDS, type SceneConfig } from './scenes';

export interface TimedScene extends SceneConfig {
  /** Frames of clip playback, after trimming and speed. */
  clipFrames: number;
  /** Frames on screen: playback plus the held last frame. */
  frames: number;
  /** The clip's width / height. */
  aspect: number;
}

export interface PromoProps {
  scenes: TimedScene[];
  music: boolean;
  [key: string]: unknown;
}

export const TRANSITION_FRAMES = Math.round(TRANSITION_SECONDS * FPS);
export const OUTRO_FRAMES = Math.round(OUTRO_SECONDS * FPS);

export const clipSrc = (clip: string) => staticFile(`clips/${clip}.mp4`);

async function probe(clip: string) {
  const input = new Input({ formats: ALL_FORMATS, source: new UrlSource(clipSrc(clip)) });
  try {
    const [duration, track] = await Promise.all([input.computeDuration(), input.getPrimaryVideoTrack()]);
    if (!track) throw new Error('no video track');
    return { duration, aspect: track.displayWidth / track.displayHeight };
  } catch (e) {
    throw new Error(
      `Could not read public/clips/${clip}.mp4 (${(e as Error).message}). ` +
        'Record the clips with `npm run capture`, or make stand-ins with `npm run clips:sample`.',
    );
  } finally {
    input.dispose();
  }
}

/** Times every scene from its clip's real length, so the video fits whatever was recorded. */
export const calculatePromoMetadata: CalculateMetadataFunction<PromoProps> = async () => {
  const scenes = await Promise.all(
    SCENES.map(async (scene): Promise<TimedScene> => {
      const { duration, aspect } = await probe(scene.clip);
      const seconds = (duration - (scene.trimStart ?? 0) - (scene.trimEnd ?? 0)) / (scene.speed ?? 1);
      const clipFrames = Math.max(1, Math.floor(seconds * FPS));
      const frames = clipFrames + Math.round((scene.holdEnd ?? HOLD_END) * FPS);
      return { ...scene, clipFrames, frames, aspect };
    }),
  );
  const music = getStaticFiles().some((f) => f.name === 'music.mp3');
  // Each transition overlaps the scenes on either side of it, the outro included.
  const durationInFrames = scenes.reduce((sum, s) => sum + s.frames, OUTRO_FRAMES) - scenes.length * TRANSITION_FRAMES;
  return { durationInFrames, fps: FPS, props: { scenes, music } };
};
