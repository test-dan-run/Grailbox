import { Audio, Video } from '@remotion/media';
import { linearTiming, TransitionSeries } from '@remotion/transitions';
import { slide } from '@remotion/transitions/slide';
import { Fragment } from 'react';
import { AbsoluteFill, Easing, Freeze, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

import icon from '../../assets/icon.png';
import { clipSrc, OUTRO_FRAMES, TRANSITION_FRAMES, type PromoProps, type TimedScene } from './metadata';
import { OUTRO } from './scenes';
import { colors, fontFamily } from './theme';

/*
 * 1080 × 1920: a caption on top, the app's screen recording below it on the
 * brand background. Only the screen itself is shown, never a device frame,
 * since store reviewers reject device imagery.
 */

const CAPTION_TOP = 130;
const CAPTION_HEIGHT = 300;
const SCREEN_TOP = 470;
const SCREEN_BOTTOM_GAP = 100;
const SCREEN_MAX_WIDTH = 900;
// A slide rather than a fade, so two captions never sit on top of each other.
const TIMING = linearTiming({ durationInFrames: TRANSITION_FRAMES, easing: Easing.inOut(Easing.cubic) });

export const Promo: React.FC<PromoProps> = ({ scenes, music }) => {
  const { durationInFrames, fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: `linear-gradient(180deg, ${colors.brandMint} 0%, #F0FDFA 45%, ${colors.white} 100%)` }}>
      <TransitionSeries>
        {scenes.map((scene) => (
          <Fragment key={scene.clip}>
            <TransitionSeries.Sequence durationInFrames={scene.frames}>
              <ClipScene scene={scene} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition presentation={slide({ direction: 'from-right' })} timing={TIMING} />
          </Fragment>
        ))}
        <TransitionSeries.Sequence durationInFrames={OUTRO_FRAMES}>
          <Outro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      {music && (
        <Audio
          src={staticFile('music.mp3')}
          volume={(f) =>
            interpolate(f, [0, fps / 2, durationInFrames - fps, durationInFrames], [0, 0.8, 0.8, 0], {
              extrapolateLeft: 'clamp',
              extrapolateRight: 'clamp',
            })
          }
        />
      )}
    </AbsoluteFill>
  );
};

function ClipScene({ scene }: { scene: TimedScene }) {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 }, durationInFrames: 18 });

  let screenHeight = height - SCREEN_TOP - SCREEN_BOTTOM_GAP;
  let screenWidth = screenHeight * scene.aspect;
  if (screenWidth > SCREEN_MAX_WIDTH) {
    screenWidth = SCREEN_MAX_WIDTH;
    screenHeight = screenWidth / scene.aspect;
  }

  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          top: CAPTION_TOP,
          height: CAPTION_HEIGHT,
          left: 60,
          right: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          whiteSpace: 'pre-line',
          fontFamily,
          fontWeight: 800,
          fontSize: 80,
          lineHeight: 1.12,
          letterSpacing: -1.5,
          color: colors.textPrimary,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [24, 0])}px)`,
        }}
      >
        {scene.caption}
      </div>
      <div
        style={{
          position: 'absolute',
          top: SCREEN_TOP,
          left: (width - screenWidth) / 2,
          width: screenWidth,
          height: screenHeight,
          borderRadius: 44,
          overflow: 'hidden',
          backgroundColor: colors.cameraGround,
          boxShadow: '0 30px 80px rgba(15, 118, 110, 0.25), 0 8px 24px rgba(15, 23, 42, 0.12)',
        }}
      >
        <Freeze frame={scene.clipFrames - 1} active={(f) => f >= scene.clipFrames}>
          <Video
            src={clipSrc(scene.clip)}
            trimBefore={Math.round((scene.trimStart ?? 0) * fps)}
            playbackRate={scene.speed ?? 1}
            muted
            objectFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Freeze>
      </div>
    </AbsoluteFill>
  );
}

function Outro() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame, fps, config: { damping: 14, mass: 0.6 } });
  const rise = spring({ frame: frame - 6, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', gap: 36, fontFamily }}>
      <Img
        src={icon}
        style={{
          width: 260,
          height: 260,
          borderRadius: 60,
          boxShadow: '0 24px 60px rgba(15, 118, 110, 0.3)',
          transform: `scale(${interpolate(pop, [0, 1], [0.6, 1])})`,
          opacity: pop,
        }}
      />
      <div style={{ textAlign: 'center', opacity: rise, transform: `translateY(${interpolate(rise, [0, 1], [30, 0])}px)` }}>
        <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -3, color: colors.textPrimary }}>{OUTRO.title}</div>
        <div style={{ fontSize: 54, fontWeight: 700, color: colors.brandPrimary, marginTop: 8 }}>{OUTRO.tagline}</div>
      </div>
    </AbsoluteFill>
  );
}
