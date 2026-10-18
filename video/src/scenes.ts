/*
 * The store video, scene by scene. Each scene plays one clip under a
 * caption. scripts/capture.sh records each clip while the Maestro flow of the
 * same name (maestro/<clip>.yaml) runs.
 *
 * Google Play autoplays the first 30 seconds muted, so the captions carry the
 * story. Its listing rules also forbid calls to action ("Download now") and
 * ranking or price claims ("#1", "Best", "Free") in the video.
 */

export interface SceneConfig {
  /** A clip in public/clips, without ".mp4". */
  clip: string;
  caption: string;
  /** Seconds cut from the start and end of the clip. */
  trimStart?: number;
  trimEnd?: number;
  /** Above 1 speeds the clip up, to tighten slow navigation. */
  speed?: number;
  /** Seconds the clip's last frame stays on screen. Default HOLD_END. */
  holdEnd?: number;
}

export const SCENES: SceneConfig[] = [
  // The scan results get a longer hold, so there is time to read them.
  { clip: '01-scan-owned', caption: 'Already own it?\nSnap a photo to check', holdEnd: 1.6 },
  { clip: '02-scan-wishlist', caption: 'Spot a grail\nfrom your wishlist', holdEnd: 1.6 },
  { clip: '03-collection', caption: 'Your whole collection,\nsorted' },
  { clip: '04-item', caption: 'Every detail\nof every piece' },
  { clip: '06-wishlist', caption: "Track the grails\nyou're hunting" },
  { clip: '05-journal', caption: 'Remember\nevery find' },
];

export const OUTRO = { title: 'Grailbox', tagline: 'Offline. Private. Yours.' };

export const FPS = 30;
export const HOLD_END = 0.8;
export const TRANSITION_SECONDS = 0.5;
export const OUTRO_SECONDS = 2.5;
