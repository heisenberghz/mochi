import type { RefObject } from 'react';
import { ANCHORS, ART, ART_PALETTE } from '../../../shared/art-anchors';
import type { Behavior } from '../../../shared/types';

interface PetSpriteProps {
  behavior: Behavior;
  facing: -1 | 1;
  poked: boolean;
  interactive: boolean;
  /** The pet is settling after being put down. */
  settling: boolean;
  /** The pet's animation has stopped working, so it stands still. */
  animationPaused: boolean;
  /** The art itself, so it can be checked against the click target. */
  spriteRef?: RefObject<HTMLDivElement | null>;
}

export function PetSprite({
  behavior,
  facing,
  poked,
  interactive,
  settling,
  animationPaused,
  spriteRef,
}: PetSpriteProps) {
  const classes = [
    'pet-sprite',
    `behavior-${behavior}`,
    poked ? 'poked' : '',
    interactive ? 'interactive' : '',
    settling ? 'settling' : '',
    animationPaused ? 'paused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} aria-hidden="true" ref={spriteRef}>
      <svg viewBox="0 0 200 220" className="pet-svg" role="presentation">
        <defs>
          <linearGradient id="body-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FBF3E6" />
            <stop offset="72%" stopColor="#F3E7D6" />
            <stop offset="100%" stopColor="#E9D8C2" />
          </linearGradient>
          <linearGradient id="scarf-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E7A15D" />
            <stop offset="100%" stopColor="#D1843C" />
          </linearGradient>
        </defs>

        <ellipse
          className="contact-shadow"
          cx={ART.centreX}
          cy={ART.shadow}
          rx="60"
          ry="9"
          fill={ART_PALETTE.ink}
          opacity="0.12"
        />

        <g
          className="facing"
          style={{
            transform: facing === 1 ? 'scaleX(1)' : 'scaleX(-1)',
            transformOrigin: `${ANCHORS.character.x}px ${ANCHORS.character.y}px`,
          }}
        >
          <g className="character">
            <g className="tail-group">
              <path
                className="tail-outline"
                d="M148 170 C183 158 190 184 166 198"
                stroke="#2A2622"
                strokeWidth="18"
                strokeLinecap="round"
                fill="none"
                opacity="0.06"
              />
              <path
                className="tail"
                d="M148 170 C183 158 190 184 166 198"
                stroke="#E9D8C2"
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
              />
            </g>

            <g className="ears">
              <path
                className="ear ear-left"
                d="M61 82 C53 64 53 43 62 35 C72 43 87 57 94 66 Z"
                fill="#F3E7D6"
              />
              <path
                className="ear ear-right"
                d="M139 82 C147 64 147 43 138 35 C128 43 113 57 106 66 Z"
                fill="#F3E7D6"
              />
              <path
                className="inner-ear inner-ear-left"
                d="M65 72 C60 59 60 48 64 42 C70 48 79 56 84 63 Z"
                fill="#E8B7A6"
              />
              <path
                className="inner-ear inner-ear-right"
                d="M135 72 C140 59 140 48 136 42 C130 48 121 56 116 63 Z"
                fill="#E8B7A6"
              />
            </g>

            <path
              className="body"
              d="M100 64 C142 64 162 96 162 144 C162 184 136 204 100 204 C64 204 38 184 38 144 C38 96 58 64 100 64 Z"
              fill="url(#body-fill)"
            />
            <ellipse
              className="belly"
              cx="100"
              cy="158"
              rx="46"
              ry="38"
              fill="#FFF8EC"
              opacity="0.52"
            />

            <g className="face">
              <g className="eye-open eye-left">
                <ellipse cx="82" cy="104" rx="6.5" ry="8" fill="#2A2622" />
                <ellipse cx="80" cy="101" rx="2" ry="2.4" fill="#FFFDF8" />
              </g>
              <g className="eye-open eye-right">
                <ellipse cx="118" cy="104" rx="6.5" ry="8" fill="#2A2622" />
                <ellipse cx="116" cy="101" rx="2" ry="2.4" fill="#FFFDF8" />
              </g>
              <g className="eye-closed">
                <path
                  d="M74 105 Q82 110 90 105"
                  stroke="#2A2622"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M110 105 Q118 110 126 105"
                  stroke="#2A2622"
                  strokeWidth="3"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
              <ellipse cx="92" cy="118" rx="6" ry="3.5" fill="#E8B7A6" opacity="0.55" />
              <ellipse cx="108" cy="118" rx="6" ry="3.5" fill="#E8B7A6" opacity="0.55" />
              <path d="M96 114 L104 114 L100 119 Z" fill="#2A2622" />
              <path
                className="mouth"
                d="M94 122 Q97 126 100 122 Q103 126 106 122"
                stroke="#2A2622"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <g className="whiskers" stroke="#B9A48B" strokeWidth="1.5" strokeLinecap="round">
                <path d="M70 116 L54 112" />
                <path d="M70 121 L54 121" />
                <path d="M130 116 L146 112" />
                <path d="M130 121 L146 121" />
              </g>
            </g>

            <g className="scarf">
              <path
                className="scarf-band"
                d="M55 138 C72 151 128 151 145 138 L151 155 C127 171 73 171 49 155 Z"
                fill="url(#scarf-fill)"
              />
              <circle cx="100" cy="151" r="9" fill="#C97833" />
              <path
                className="scarf-tail"
                d="M103 156 C110 165 109 176 101 183 L91 177 C98 170 98 162 94 157 Z"
                fill="#D98C45"
              />
            </g>

            <g className="paws">
              <ellipse className="paw paw-left" cx="77" cy="196" rx="18" ry="11" fill="#E9D8C2" />
              <ellipse className="paw paw-right" cx="123" cy="196" rx="18" ry="11" fill="#E9D8C2" />
              <path
                d="M72 197 L72 201 M82 197 L82 201"
                stroke="#CBB69C"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M118 197 L118 201 M128 197 L128 201"
                stroke="#CBB69C"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </g>

            <g className="glasses" opacity="0">
              <circle cx="82" cy="104" r="12" fill="none" stroke="#2A2622" strokeWidth="2.4" />
              <circle cx="118" cy="104" r="12" fill="none" stroke="#2A2622" strokeWidth="2.4" />
              <path d="M94 104 L106 104" stroke="#2A2622" strokeWidth="2.4" strokeLinecap="round" />
              <path
                d="M70 102 L62 100 M130 102 L138 100"
                stroke="#2A2622"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
          </g>
        </g>

        <g className="zzz" fill="#2A2622" fontFamily="Georgia, serif" fontWeight="600">
          <text className="zzz-letter zzz-one" x="158" y="78">
            z
          </text>
          <text className="zzz-letter zzz-two" x="171" y="62">
            z
          </text>
          <text className="zzz-letter zzz-three" x="184" y="47">
            z
          </text>
        </g>

        <g className="sparkles" fill="#D98C45">
          <circle className="sparkle sparkle-one" cx="46" cy="88" r="3.2" />
          <circle className="sparkle sparkle-two" cx="158" cy="96" r="2.5" />
          <circle className="sparkle sparkle-three" cx="36" cy="132" r="2" />
          <circle className="sparkle sparkle-four" cx="168" cy="142" r="3" />
          <path className="sparkle sparkle-five" d="M100 30 l2.6 5.2 5.8.8 -4.2 4.1 1 5.8 -5.2 -2.8 -5.2 2.8 1 -5.8 -4.2 -4.1 5.8 -.8 z" />
        </g>
      </svg>
    </div>
  );
}
