import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

import { colors } from '@/theme';

/*
 * Stroke icons redrawn from the design canvas: 24×24 grid, 1.7–2 px stroke,
 * round caps. Icons are decorative; the control around them carries the label.
 */

export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Icon({
  size = 20,
  color = colors.textPrimary,
  strokeWidth = 1.8,
  fill = 'none',
  children,
}: IconProps & { fill?: string; children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={fill === 'none' ? color : 'none'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

const STAR = 'M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z';

export const ScanIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <Path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
    <Circle cx={12} cy={12} r={3} />
  </Icon>
);

export const StarIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <Path d={STAR} />
  </Icon>
);

export const StarFilledIcon = ({ size = 20, color = colors.textPrimary }: IconProps) => (
  <Icon size={size} fill={color}>
    <Path d={STAR} fill={color} />
  </Icon>
);

export const SearchIcon = (p: IconProps) => (
  <Icon {...p}>
    <Circle cx={11} cy={11} r={7} />
    <Path d="M20 20l-3.5-3.5" />
  </Icon>
);

export const FilterIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
    <Circle cx={16} cy={7} r={2} />
    <Circle cx={10} cy={17} r={2} />
  </Icon>
);

export const MoreIcon = ({ size = 20, color = colors.textSecondary }: IconProps) => (
  <Icon size={size} fill={color}>
    <Circle cx={5} cy={12} r={1.7} fill={color} />
    <Circle cx={12} cy={12} r={1.7} fill={color} />
    <Circle cx={19} cy={12} r={1.7} fill={color} />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <Path d="M12 5v14M5 12h14" />
  </Icon>
);

export const MinusIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <Path d="M5 12h14" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon strokeWidth={1.6} {...p}>
    <Rect x={3} y={4} width={18} height={16} rx={3} />
    <Circle cx={9} cy={10} r={1.6} />
    <Path d="M21 16l-5-5-8 9" />
  </Icon>
);

export const CameraIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <Path d="M4 8h3l2-3h6l2 3h3v11H4z" />
    <Circle cx={12} cy={13} r={3.5} />
  </Icon>
);

export const VideoIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <Rect x={3} y={6.5} width={12.5} height={11} rx={2.5} />
    <Path d="M15.5 10.5l5-3v9l-5-3z" />
  </Icon>
);

export const ChevronLeftIcon = (p: IconProps) => (
  <Icon strokeWidth={1.9} {...p}>
    <Path d="M15 5l-7 7 7 7" />
  </Icon>
);

export const ChevronRightIcon = (p: IconProps) => (
  <Icon strokeWidth={1.9} {...p}>
    <Path d="M9 5l7 7-7 7" />
  </Icon>
);

export const ChevronDownIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 9l6 6 6-6" />
  </Icon>
);

export const ChevronUpIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M6 15l6-6 6 6" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const FlashIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M13 3L5 14h6l-1 7 8-11h-6z" />
  </Icon>
);

export const ShareIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3v12M7 8l5-5 5 5M5 14v5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-5" />
  </Icon>
);

export const EditIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M4 20h4L19 9l-4-4L4 16z" />
    <Path d="M13.5 6.5l4 4" />
  </Icon>
);

export const BadgeIcon = (p: IconProps) => (
  <Icon strokeWidth={2.2} {...p}>
    <Path d="M12 3l2.4 1.8 3-.1.9 2.8 2.4 1.8-.9 2.8.9 2.8-2.4 1.8-.9 2.8-3-.1L12 21l-2.4-1.8-3 .1-.9-2.8-2.4-1.8.9-2.8-.9-2.8 2.4-1.8.9-2.8 3 .1z" />
    <Path d="M9 12l2 2 4-4" />
  </Icon>
);

export const PinIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <Circle cx={12} cy={9.5} r={2.5} />
  </Icon>
);

export const PriceTagIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M3 12V4h8l10 10-8 8z" />
    <Circle cx={7.5} cy={8.5} r={1.5} />
  </Icon>
);

export const StorageIcon = (p: IconProps) => (
  <Icon {...p}>
    <Rect x={3} y={4} width={18} height={16} rx={2} />
    <Path d="M3 12h18M9 8h6M9 16h6" />
  </Icon>
);

export const WarningIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <Path d="M12 4l9 16H3z" />
    <Path d="M12 10v4M12 17v.5" />
  </Icon>
);

export const LinesIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <Path d="M5 7h14M5 12h14M5 17h9" />
  </Icon>
);

export const SettingsIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <Path d="M18.75 10.13L21.06 10.42L21.06 13.58L18.75 13.87L18.09 15.45L19.53 17.29L17.29 19.53L15.45 18.09L13.87 18.75L13.58 21.06L10.42 21.06L10.13 18.75L8.55 18.09L6.71 19.53L4.47 17.29L5.91 15.45L5.25 13.87L2.94 13.58L2.94 10.42L5.25 10.13L5.91 8.55L4.47 6.71L6.71 4.47L8.55 5.91L10.13 5.25L10.42 2.94L13.58 2.94L13.87 5.25L15.45 5.91L17.29 4.47L19.53 6.71L18.09 8.55Z" />
    <Circle cx={12} cy={12} r={3} />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon strokeWidth={2} {...p}>
    <Path d="M5 12.5l4.5 4.5L19 7.5" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon strokeWidth={1.7} {...p}>
    <Path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon strokeWidth={1.8} {...p}>
    <Path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <Path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icon>
);

export const DownloadIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M12 3v12M7 10l5 5 5-5M5 19h14" />
  </Icon>
);

export const ReorderIcon = (p: IconProps) => (
  <Icon {...p}>
    <Path d="M8 4v16M4 8l4-4 4 4M16 20V4M12 16l4 4 4-4" />
  </Icon>
);

/** The chosen app logo: Capsule Star, without its tile. */
export function CapsuleLogo({
  size = 152,
  seam = colors.textPrimary,
  shine = colors.brandMint,
  hideStar = false,
}: {
  size?: number;
  seam?: string;
  shine?: string;
  hideStar?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="16 16 68 68">
      <Path d="M22 50A28 28 0 0 1 78 50Z" fill={colors.white} />
      <Path d="M22 50A28 28 0 0 0 78 50Z" fill={colors.brandPrimary} />
      <Path d="M32 39A20 20 0 0 1 43 30" fill="none" stroke={shine} strokeWidth={4} strokeLinecap="round" />
      <Rect x={19} y={47} width={62} height={6} rx={3} fill={seam} />
      {!hideStar && <LogoStar seam={seam} />}
    </Svg>
  );
}

export function LogoStar({ seam = colors.textPrimary }: { seam?: string }) {
  return (
    <G>
      <Path
        d="M50 39L52.8 46.1L60.5 46.6L54.6 51.5L56.5 58.9L50 54.8L43.5 58.9L45.4 51.5L39.5 46.6L47.2 46.1Z"
        fill={colors.accentStar}
        stroke={seam}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
    </G>
  );
}

/** The star alone, framed so it can spin in place over the logo's seam. */
export function StarOnly({ size, seam = colors.textPrimary }: { size: number; seam?: string }) {
  return (
    <Svg width={size} height={size} viewBox="38 37 24 24">
      <LogoStar seam={seam} />
    </Svg>
  );
}
