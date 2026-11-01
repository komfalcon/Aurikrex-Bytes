import { useId } from "react";

interface EndOfFeedIllustrationProps {
  isFullyRead?: boolean;
  className?: string;
}

export function EndOfFeedIllustration({
  isFullyRead = false,
  className = "",
}: EndOfFeedIllustrationProps) {
  const uid = useId().replace(/:/g, "");
  const cardShadowId = `feed-card-shadow-${uid}`;
  const bubbleShadowId = `feed-bubble-shadow-${uid}`;
  const auraGlowId = `feed-aura-${uid}`;
  const shadowGradId = `feed-ground-${uid}`;
  const brandGradId = `feed-brand-${uid}`;
  const brandGradLightId = `feed-brand-light-${uid}`;
  const potGradId = `feed-pot-${uid}`;
  const leafGrad1Id = `feed-leaf-1-${uid}`;
  const leafGrad2Id = `feed-leaf-2-${uid}`;
  const bubbleGradId = `feed-bubble-${uid}`;

  return (
    <svg
      className={`end-of-feed-illustration ${className}`}
      viewBox="0 0 280 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={
        isFullyRead
          ? "Illustration celebrating completion of today's briefing"
          : "Illustration showing more unread bytes above"
      }
    >
      <defs>
        {/* Ambient Glow */}
        <radialGradient
          id={auraGlowId}
          cx="50%"
          cy="48%"
          r="48%"
          fx="50%"
          fy="48%"
        >
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.20" />
          <stop offset="65%" stopColor="#38bdf8" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>

        {/* Ground Ellipse Soft Shadow */}
        <radialGradient
          id={shadowGradId}
          cx="50%"
          cy="50%"
          r="50%"
        >
          <stop offset="0%" stopColor="#0f172a" stopOpacity="0.18" />
          <stop offset="70%" stopColor="#0f172a" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
        </radialGradient>

        {/* Brand Gradients */}
        <linearGradient
          id={brandGradId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>

        <linearGradient
          id={brandGradLightId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Plant Pot Gradient */}
        <linearGradient
          id={potGradId}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>

        {/* Leaf Gradients */}
        <linearGradient
          id={leafGrad1Id}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="100%" stopColor="#0369a1" />
        </linearGradient>

        <linearGradient
          id={leafGrad2Id}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#0284c7" />
        </linearGradient>

        {/* Speech Bubble Gradient */}
        <linearGradient
          id={bubbleGradId}
          x1="0%"
          y1="0%"
          x2="0%"
          y2="100%"
        >
          <stop offset="0%" stopColor="#f0f9ff" />
          <stop offset="100%" stopColor="#e0f2fe" />
        </linearGradient>

        {/* Drop Shadow for Floating Cards */}
        <filter
          id={cardShadowId}
          x="-15%"
          y="-15%"
          width="130%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="8"
            stdDeviation="6"
            floodColor="#0f172a"
            floodOpacity="0.12"
          />
        </filter>

        {/* Drop Shadow for Bubble */}
        <filter
          id={bubbleShadowId}
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
        >
          <feDropShadow
            dx="0"
            dy="3"
            stdDeviation="4"
            floodColor="#0284c7"
            floodOpacity="0.15"
          />
        </filter>
      </defs>

      {/* Background Glow */}
      <ellipse cx="140" cy="94" rx="98" ry="62" fill={`url(#${auraGlowId})`} />

      {/* Ground Soft Shadows */}
      <ellipse cx="140" cy="162" rx="86" ry="9" fill={`url(#${shadowGradId})`} />
      <ellipse cx="54" cy="162" rx="19" ry="4.5" fill={`url(#${shadowGradId})`} opacity="0.65" />

      {/* Potted Plant on the Left */}
      <g className="feed-plant-group">
        {/* Pot Base & Rim */}
        <path
          className="feed-plant-pot"
          d="M 42 130 L 46 157 C 46 160 62 160 62 157 L 66 130 Z"
          fill={`url(#${potGradId})`}
          stroke="var(--line, #cbd5e1)"
          strokeWidth="1.2"
        />
        <rect
          className="feed-plant-rim"
          x="39.5"
          y="126"
          width="29"
          height="5.5"
          rx="2.75"
          fill="var(--surface, #ffffff)"
          stroke="var(--line, #cbd5e1)"
          strokeWidth="1.2"
        />

        {/* Leaves with sway animations */}
        <g className="feed-leaf-center">
          <path
            d="M 54 127 C 42 115 32 93 49 81 C 61 93 57 116 54 127 Z"
            fill={`url(#${leafGrad1Id})`}
          />
          <path
            d="M 54 127 Q 50 103 49 81"
            stroke="rgba(255, 255, 255, 0.45)"
            strokeWidth="1"
            strokeLinecap="round"
            fill="none"
          />
        </g>

        <g className="feed-leaf-left">
          <path
            d="M 52 128 C 30 126 21 108 34 98 C 45 107 48 119 52 128 Z"
            fill={`url(#${leafGrad2Id})`}
          />
        </g>

        <g className="feed-leaf-right">
          <path
            d="M 56 128 C 69 122 75 106 66 97 C 56 105 56 120 56 128 Z"
            fill={`url(#${leafGrad1Id})`}
            opacity="0.9"
          />
        </g>
      </g>

      {/* Floating Card Stack */}
      <g className="feed-card-stack" filter={`url(#${cardShadowId})`}>
        {/* Bottom Tilted Card */}
        <rect
          x="100"
          y="56"
          width="82"
          height="96"
          rx="10"
          transform="rotate(-6 141 104)"
          fill="var(--surface-2, #f8fafc)"
          stroke="var(--line, #e2e8f0)"
          strokeWidth="1"
          opacity="0.75"
        />

        {/* Middle Tilted Card */}
        <rect
          x="102"
          y="52"
          width="82"
          height="96"
          rx="10"
          transform="rotate(3 143 100)"
          fill="var(--surface, #ffffff)"
          stroke="var(--line, #e2e8f0)"
          strokeWidth="1.1"
          opacity="0.9"
        />

        {/* Top Active Card */}
        <g className="feed-top-card">
          <rect
            x="101"
            y="44"
            width="86"
            height="100"
            rx="11"
            fill="var(--surface, #ffffff)"
            stroke="var(--line, #cbd5e1)"
            strokeWidth="1.3"
          />

          {/* Bytes "B" Emblem in Header */}
          <rect
            x="110"
            y="52"
            width="22"
            height="22"
            rx="6"
            fill={`url(#${brandGradId})`}
          />
          {/* Stylized White "B" Mark */}
          <path
            d="M 116 57 h 6 c 2 0 3.3 0.9 3.3 2.3 c 0 0.9 -0.6 1.6 -1.6 2 c 1.2 0.3 1.9 1.1 1.9 2.3 c 0 1.5 -1.4 2.6 -3.6 2.6 h -6 z M 118.4 59 v 2 h 3.1 c 0.8 0 1.4 -0.3 1.4 -1 c 0 -0.7 -0.6 -1 -1.4 -1 z M 118.4 62.6 v 2.2 h 3.4 c 0.9 0 1.5 -0.4 1.5 -1.1 c 0 -0.7 -0.6 -1.1 -1.5 -1.1 z"
            fill="#ffffff"
          />

          {/* Article Header Skeleton Lines */}
          <rect
            x="138"
            y="55"
            width="40"
            height="4"
            rx="2"
            fill={`url(#${brandGradLightId})`}
            opacity="0.9"
          />
          <rect
            x="138"
            y="63"
            width="28"
            height="3"
            rx="1.5"
            fill="var(--muted, #94a3b8)"
            opacity="0.38"
          />
          <rect
            x="138"
            y="69"
            width="34"
            height="3"
            rx="1.5"
            fill="var(--muted, #94a3b8)"
            opacity="0.25"
          />

          {/* Card Article Image Frame */}
          <rect
            x="110"
            y="81"
            width="68"
            height="36"
            rx="6"
            fill="var(--surface-2, #f1f5f9)"
            stroke="var(--line, #e2e8f0)"
            strokeWidth="0.8"
          />
          <path
            d="M 118 111 l 12 -13 l 13 13 l 9 -8 l 18 17 h -52 z"
            fill={`url(#${brandGradLightId})`}
            opacity="0.32"
          />
          <circle cx="158" cy="91" r="3.5" fill="#38bdf8" opacity="0.65" />

          {/* Footer Preview Lines & Source Avatars */}
          <rect
            x="110"
            y="126"
            width="46"
            height="3"
            rx="1.5"
            fill="var(--muted, #94a3b8)"
            opacity="0.3"
          />
          <circle cx="166" cy="127.5" r="3" fill="#0284c7" opacity="0.5" />
          <circle cx="173" cy="127.5" r="3" fill="#38bdf8" opacity="0.5" />
        </g>
      </g>

      {/* Upward Arrow or Completion Mark */}
      {!isFullyRead ? (
        <g className="feed-arrow-bob">
          {/* Dynamic swooping arrow */}
          <path
            d="M 190 128 C 198 108 200 85 186 60"
            fill="none"
            stroke={`url(#${brandGradId})`}
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M 176 67 L 185 56 L 196 65"
            fill="none"
            stroke={`url(#${brandGradId})`}
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Energy accents */}
          <line
            x1="174"
            y1="50"
            x2="169"
            y2="46"
            stroke="#38bdf8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <line
            x1="185"
            y1="45"
            x2="185"
            y2="39"
            stroke="#0284c7"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <line
            x1="197"
            y1="50"
            x2="202"
            y2="46"
            stroke="#38bdf8"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g className="feed-check-badge">
          {/* Celebration Ring & Checkmark */}
          <circle
            cx="188"
            cy="76"
            r="16"
            fill={`url(#${brandGradId})`}
            filter={`url(#${bubbleShadowId})`}
          />
          <circle
            cx="188"
            cy="76"
            r="20"
            fill="none"
            stroke="#38bdf8"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.75"
          />
          <path
            d="M 181 76 L 186 81 L 195 71"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      )}

      {/* Speech Bubble */}
      <g className="feed-speech-bubble" filter={`url(#${bubbleShadowId})`}>
        <path
          className="feed-speech-bubble-body"
          d="M 206 32 h 54 a 9 9 0 0 1 9 9 v 36 a 9 9 0 0 1 -9 9 h -42 l -8 7 v -7 h -4 a 9 9 0 0 1 -9 -9 v -36 a 9 9 0 0 1 9 -9 z"
          fill={`url(#${bubbleGradId})`}
          stroke="rgba(2, 132, 199, 0.4)"
          strokeWidth="1.2"
        />
        {!isFullyRead ? (
          <>
            <text
              className="feed-bubble-text-1"
              x="237"
              y="48"
              textAnchor="middle"
              fill="#0369a1"
              fontSize="10"
              fontWeight="700"
              fontFamily="var(--sans, system-ui, sans-serif)"
            >
              Still
            </text>
            <text
              className="feed-bubble-text-2"
              x="237"
              y="60"
              textAnchor="middle"
              fill="#0369a1"
              fontSize="10"
              fontWeight="700"
              fontFamily="var(--sans, system-ui, sans-serif)"
            >
              unread
            </text>
            <text
              className="feed-bubble-text-3"
              x="237"
              y="72"
              textAnchor="middle"
              fill="#0284c7"
              fontSize="9"
              fontWeight="600"
              fontFamily="var(--sans, system-ui, sans-serif)"
            >
              above
            </text>
          </>
        ) : (
          <>
            <text
              className="feed-bubble-text-1"
              x="237"
              y="53"
              textAnchor="middle"
              fill="#0369a1"
              fontSize="10"
              fontWeight="700"
              fontFamily="var(--sans, system-ui, sans-serif)"
            >
              All caught
            </text>
            <text
              className="feed-bubble-text-2"
              x="237"
              y="67"
              textAnchor="middle"
              fill="#0284c7"
              fontSize="10"
              fontWeight="700"
              fontFamily="var(--sans, system-ui, sans-serif)"
            >
              up!
            </text>
          </>
        )}
      </g>
    </svg>
  );
}
