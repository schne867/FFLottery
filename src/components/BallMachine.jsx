import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';
import { TeamAvatar } from './TeamAvatar';
import { CHUTE, createDrumState, startEject, startRise, step } from '../utils/drumPhysics';
import { EJECT_SECONDS, GOLDEN_SECONDS } from '../utils/revealTiming';

// Normalized area around the drum (radius 1) that also fits the chute and the golden ball's rise point
const VIEW = { minX: -1.15, minY: -1.5, width: 3.3, height: 2.65 };
const MIN_DRUM_RADIUS_PX = 40;
const MAX_DRUM_RADIUS_PX = 320;

/**
 * Largest drum radius (px) whose machine drawing fits in the given space.
 */
export function fitDrumRadius(availableWidth, availableHeight) {
  const radius = Math.min(availableWidth / VIEW.width, availableHeight / VIEW.height);
  return Math.min(MAX_DRUM_RADIUS_PX, Math.max(MIN_DRUM_RADIUS_PX, radius));
}

/**
 * Glass lottery drum with one avatar ball per team, animated by drumPhysics.
 * Ball positions are written straight to the DOM each frame (no React re-render per frame).
 */
export function BallMachine({ teams, jetOn, ejectId = null, riseId = null, hiddenIds = [], drumRadiusPx = 120, children }) {
  const [drum] = useState(() => createDrumState(teams.map(team => team.userId)));
  const ballElements = useRef(new Map());
  const jetOnRef = useRef(jetOn);
  jetOnRef.current = jetOn;

  useEffect(() => {
    if (ejectId) startEject(drum, ejectId, EJECT_SECONDS);
  }, [drum, ejectId]);

  useEffect(() => {
    if (riseId) startRise(drum, riseId, GOLDEN_SECONDS);
  }, [drum, riseId]);

  useLayoutEffect(() => {
    let frameId = null;
    let lastTime = null;

    const render = () => {
      for (const ball of drum.balls) {
        const element = ballElements.current.get(ball.id);
        if (!element) continue;
        const left = (ball.x - VIEW.minX - drum.ballRadius) * drumRadiusPx;
        const top = (ball.y - VIEW.minY - drum.ballRadius) * drumRadiusPx;
        element.style.transform = `translate(${left}px, ${top}px)`;
      }
    };

    const tick = now => {
      if (lastTime !== null) step(drum, (now - lastTime) / 1000, { jetOn: jetOnRef.current });
      lastTime = now;
      render();
      frameId = requestAnimationFrame(tick);
    };

    render();
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [drum, drumRadiusPx]);

  const ballSizePx = drum.ballRadius * 2 * drumRadiusPx;
  const hidden = new Set(hiddenIds);

  return (
    <Box
      data-testid="ball-machine"
      sx={{
        position: 'relative',
        width: VIEW.width * drumRadiusPx,
        height: VIEW.height * drumRadiusPx,
        mx: 'auto',
        flexShrink: 0,
      }}
    >
      <svg
        width={VIEW.width * drumRadiusPx}
        height={VIEW.height * drumRadiusPx}
        viewBox={`${VIEW.minX} ${VIEW.minY} ${VIEW.width} ${VIEW.height}`}
        style={{ position: 'absolute', inset: 0 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="drum-glass" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stopColor="rgba(255, 255, 255, 0.45)" />
            <stop offset="100%" stopColor="rgba(255, 255, 255, 0.08)" />
          </radialGradient>
          {/* Everything except the drum's circle, so the chute never shows through the glass */}
          <mask id="drum-outside" maskUnits="userSpaceOnUse" x={VIEW.minX} y={VIEW.minY} width={VIEW.width} height={VIEW.height}>
            <rect x={VIEW.minX} y={VIEW.minY} width={VIEW.width} height={VIEW.height} fill="white" />
            <circle cx="0" cy="0" r="1" fill="black" />
          </mask>
        </defs>
        {/* Chute: a tube from the drum mouth down to the right */}
        <g data-testid="drum-chute" mask="url(#drum-outside)">
          <line
            x1={CHUTE.mouth.x - 0.1}
            y1={CHUTE.mouth.y}
            x2={CHUTE.end.x}
            y2={CHUTE.end.y}
            stroke="rgba(255, 255, 255, 0.7)"
            strokeWidth={drum.ballRadius * 2 + 0.08}
            strokeLinecap="round"
          />
          <line
            x1={CHUTE.mouth.x - 0.1}
            y1={CHUTE.mouth.y}
            x2={CHUTE.end.x}
            y2={CHUTE.end.y}
            stroke="rgba(30, 30, 60, 0.55)"
            strokeWidth={drum.ballRadius * 2 + 0.02}
            strokeLinecap="round"
          />
        </g>
        {/* Stand */}
        <path d="M -0.45 0.97 L -0.6 1.12 L 0.6 1.12 L 0.45 0.97 Z" fill="rgba(0, 0, 0, 0.35)" />
        {/* Glass drum */}
        <circle cx="0" cy="0" r="1" fill="url(#drum-glass)" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="0.03" />
      </svg>

      {teams.map(team => {
        const isGolden = team.userId === riseId;
        const isHidden = hidden.has(team.userId);
        return (
          <Box
            key={team.userId}
            ref={element => {
              if (element) ballElements.current.set(team.userId, element);
              else ballElements.current.delete(team.userId);
            }}
            data-testid={`drum-ball-${team.userId}`}
            data-golden={isGolden ? 'true' : undefined}
            data-hidden={isHidden ? 'true' : undefined}
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: ballSizePx,
              height: ballSizePx,
              borderRadius: '50%',
              bgcolor: 'white',
              display: isHidden ? 'none' : 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: isGolden ? '3px solid gold' : 'none',
              boxShadow: isGolden
                ? '0 0 18px 6px rgba(255, 215, 0, 0.9)'
                : 'inset -4px -6px 10px rgba(0, 0, 0, 0.25), 0 2px 6px rgba(0, 0, 0, 0.4)',
              willChange: 'transform',
            }}
          >
            <TeamAvatar avatar={team.avatar} teamName={team.teamName} size={Math.round(ballSizePx * 0.78)} />
          </Box>
        );
      })}

      {children && (
        <Box
          sx={{
            position: 'absolute',
            left: -VIEW.minX * drumRadiusPx,
            top: -VIEW.minY * drumRadiusPx,
            transform: 'translate(-50%, -50%)',
            zIndex: 2,
          }}
        >
          {children}
        </Box>
      )}
    </Box>
  );
}
