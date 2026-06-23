/** 메뉴 글리프(◫,◷,✦ …) → 통일된 SVG 라인 아이콘. 와이어프레임 menu-icons.jsx 정본. */
const ICON_PATHS: Record<string, string[]> = {
  '◫': ['M3.5 5h17v14h-17z', 'M10 5v14'],
  '◷': ['M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z', 'M12 7.5V12l3 2'],
  '▤': ['M4 6h16', 'M4 12h16', 'M4 18h16'],
  '▦': ['M4 5h16v14H4z', 'M4 12h16', 'M12 5v14'],
  '⚙': ['M12 9.2a2.8 2.8 0 1 0 0 5.6 2.8 2.8 0 0 0 0-5.6z', 'M12 3.5v2.2M12 18.3v2.2M4.6 7.8l1.9 1.1M17.5 15.1l1.9 1.1M4.6 16.2l1.9-1.1M17.5 8.9l1.9-1.1'],
  '✦': ['M12 3.5l2.1 5.6 5.9.3-4.6 3.7 1.6 5.7-5-3.3-5 3.3 1.6-5.7-4.6-3.7 5.9-.3z'],
  '⬓': ['M12 3.5l8 4.2v8.6L12 20.5 4 16.3V7.7z', 'M4 7.7l8 4.3 8-4.3', 'M12 12v8.5'],
  '⚐': ['M6 3.5v17', 'M6 4.5h11l-2.5 3.5L17 11.5H6'],
  '⌗': ['M9 4 7.5 20', 'M16.5 4 15 20', 'M4.5 9h15', 'M4 15h15'],
  '⚠': ['M12 4 21 19H3z', 'M12 10v4', 'M12 16.6v.2'],
  '⛓': ['M9.5 14.5 14.5 9.5', 'M8 12l-2 2a3 3 0 0 0 4.2 4.2l2-2', 'M16 12l2-2a3 3 0 0 0-4.2-4.2l-2 2'],
  '↻': ['M19 12a7 7 0 1 1-2-4.9', 'M19 4.5V8h-3.5'],
  '⏱': ['M12 7.5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z', 'M12 11v3.5l2 1.3', 'M9.5 4h5'],
  '✓': ['M5 13l4 4L19 7'],
  '⊞': ['M5 5h14v14H5z', 'M12 9v6', 'M9 12h6'],
  '⊟': ['M5 5h14v14H5z', 'M9 12h6'],
  '⛁': ['M12 4.5c-4 0-6.5 1-6.5 2.3v10.4c0 1.3 2.5 2.3 6.5 2.3s6.5-1 6.5-2.3V6.8C18.5 5.5 16 4.5 12 4.5z', 'M5.5 7c0 1.3 2.5 2.3 6.5 2.3S18.5 8.3 18.5 7', 'M5.5 12c0 1.3 2.5 2.3 6.5 2.3s6.5-1 6.5-2.3'],
  '⇄': ['M4 9h13', 'M14 6l3 3-3 3', 'M20 15H7', 'M10 12l-3 3 3 3'],
  '↩': ['M9 7 4 12l5 5', 'M4 12h11a5 5 0 0 1 5 5v1'],
  '⤓': ['M12 4v11', 'M8 11l4 4 4-4', 'M5 20h14'],
  '✉': ['M4 6h16v12H4z', 'M4 7l8 6 8-6'],
  '⇪': ['M12 20V9', 'M8 13l4-4 4 4', 'M5 5h14'],
  '⚖': ['M12 4v15', 'M7 19h10', 'M5 8h14', 'M5 8 3 13a3 3 0 0 0 4 0z', 'M19 8l-2 5a3 3 0 0 0 4 0z'],
  '±': ['M12 5v8', 'M8 9h8', 'M8 18h8'],
  '⏳': ['M7 4h10', 'M7 20h10', 'M7 4c0 4 5 5 5 8s-5 4-5 8', 'M17 4c0 4-5 5-5 8s5 4 5 8'],
  '▥': ['M4 6h16v12H4z', 'M9 6v12', 'M14.5 6v12'],
  '⚇': ['M8 8h8a3 3 0 0 1 3 3v4a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-4a3 3 0 0 1 3-3z', 'M12 8V5', 'M9.5 13v.2M14.5 13v.2', 'M4 14h1M19 14h1'],
  '⚒': ['M14 4l6 6-2.5 2.5L11.5 6.5z', 'M11 9 4 16l4 4 7-7'],
};

interface MenuGlyphProps {
  glyph?: string;
  size?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}

export function MenuGlyph({ glyph, size = 16, color, strokeWidth = 1.7, className }: MenuGlyphProps) {
  const paths = glyph ? ICON_PATHS[glyph] : undefined;
  if (!paths) {
    return (
      <span style={{ fontSize: size, color, lineHeight: 1 }} className={className}>
        {glyph}
      </span>
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color || 'currentColor'}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`block shrink-0 ${className ?? ''}`}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}
