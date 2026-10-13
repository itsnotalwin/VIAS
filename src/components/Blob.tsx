import React, { useId } from 'react';

/** Organic grain blob, the VIAS signature shape. Fills with --blob (black on light, pale on dark). */
const PATHS = [
  'M140 14C180 12 208 54 196 98C190 122 170 128 160 148C146 178 114 200 78 190C42 180 14 150 14 112C14 78 36 66 50 46C66 22 100 16 140 14Z',
  'M168 28C198 54 204 100 178 132C160 154 150 150 136 168C116 194 76 204 46 180C16 156 8 112 30 78C44 56 38 40 62 26C92 8 140 6 168 28Z',
  'M150 10C190 18 210 62 192 100C182 122 192 142 172 162C148 188 104 198 70 178C36 158 20 120 28 88C36 58 62 50 78 32C96 12 124 6 150 10Z',
];

interface BlobProps {
  variant?: 0 | 1 | 2;
  grain?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Blob: React.FC<BlobProps> = ({ variant = 0, grain = 0.3, className, style }) => {
  const id = useId().replace(/:/g, '');
  return (
    <svg
      viewBox="0 0 200 200"
      className={className}
      style={style}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed={variant + 3} result="n" />
          {/* flecks of the opposite tone: light on a black blob, dark on a pale one */}
          <feColorMatrix
            in="n"
            type="matrix"
            values={`0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 ${grain * 2.4} -${grain * 0.9}`}
            result="gr"
          />
          <feComposite in="gr" in2="SourceAlpha" operator="in" result="grc" />
          <feMerge>
            <feMergeNode in="SourceGraphic" />
            <feMergeNode in="grc" />
          </feMerge>
        </filter>
      </defs>
      <path d={PATHS[variant]} fill="var(--blob)" filter={`url(#${id})`} />
    </svg>
  );
};
