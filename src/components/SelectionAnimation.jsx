import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { PlayArrow, SkipNext } from '@mui/icons-material';
import confetti from 'canvas-confetti';
import { TeamAvatar } from './TeamAvatar';
import { BallMachine, fitDrumRadius } from './BallMachine';
import { useSettings } from '../settings/SettingsContext';
import { useRevealSequence } from '../hooks/useRevealSequence';
import { PHASES } from '../utils/revealTiming';

const TEXT_OUTLINE = `
  -2px -2px 0 #000,
  2px -2px 0 #000,
  -2px 2px 0 #000,
  2px 2px 0 #000,
  0 0 4px #000,
  0 0 4px #000
`;

const PAPER_BACKGROUND_SX = {
  backgroundImage: 'url(/istockphoto-2167499398-612x612.jpg)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  color: 'white',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    zIndex: 0,
  },
};

// Darker field during the reveal so the drum is the focus
const REVEAL_BACKGROUND_SX = {
  ...PAPER_BACKGROUND_SX,
  '&::before': { ...PAPER_BACKGROUND_SX['&::before'], background: 'rgba(0, 0, 0, 0.55)' },
};

const CONFETTI_MS = 6000;
// Used until the drum area has been measured (and in environments without ResizeObserver)
const DEFAULT_DRUM_RADIUS_PX = 120;

function getPickLabel(pickNumber) {
  return pickNumber === 1 ? '🏆 Pick #1' : `Pick #${pickNumber}`;
}

function getHeadline(phase, selection, remainingCount) {
  switch (phase) {
    case PHASES.MIXING:
    case PHASES.EJECTING:
      return remainingCount === 2 ? 'Two teams left…' : `Drawing Pick #${selection.pickNumber}…`;
    case PHASES.GOLDEN:
      return 'And the #1 pick goes to…';
    case PHASES.REVEALING:
      return getPickLabel(selection.pickNumber);
    case PHASES.PAUSING:
      return `Up next: Pick #${selection.pickNumber - 1}`;
    default:
      return '🏆 The draft order is set!';
  }
}

// Above this many teams, board cards show only the pick number (team name on hover) so one row fits
const COMPACT_BOARD_THRESHOLD = 12;

// More teams = smaller draft-board cards so the single row fits
function getBoardSizes(numTeams) {
  if (numTeams <= 6) return { avatarSize: 48, gap: 12, maxColumnPx: 120, nameSize: '1rem', labelSize: '1.1rem' };
  if (numTeams <= 10) return { avatarSize: 44, gap: 8, maxColumnPx: 110, nameSize: '0.85rem', labelSize: '0.95rem' };
  if (numTeams <= COMPACT_BOARD_THRESHOLD) return { avatarSize: 38, gap: 6, maxColumnPx: 110, nameSize: '0.75rem', labelSize: '0.85rem' };
  return { avatarSize: 32, gap: 4, maxColumnPx: 90, nameSize: '0.75rem', labelSize: '0.8rem' };
}

// Track an element's rendered size: null until measured, or when ResizeObserver is unavailable
function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return [ref, size];
}

function useWinnerConfetti(active) {
  useEffect(() => {
    if (!active) return undefined;
    const end = Date.now() + CONFETTI_MS;
    const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };
    const interval = setInterval(() => {
      const timeLeft = end - Date.now();
      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }
      confetti({
        ...defaults,
        particleCount: 50 * (timeLeft / CONFETTI_MS),
        origin: { x: 0.1 + Math.random() * 0.8, y: Math.random() - 0.2 },
      });
    }, 250);
    return () => {
      clearInterval(interval);
      confetti.reset();
    };
  }, [active]);
}

function StartScreen({ leagueName, onStart }) {
  return (
    <Box sx={{ textAlign: 'center', height: '100%', position: 'relative' }}>
      <Paper
        elevation={8}
        sx={{
          ...PAPER_BACKGROUND_SX,
          p: 6,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Typography
          variant="h3"
          sx={{
            fontWeight: 'bold',
            mb: 6,
            color: 'white !important',
            position: 'relative',
            zIndex: 1,
            textShadow: TEXT_OUTLINE,
          }}
        >
          The {leagueName} Draft Lottery
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={onStart}
          startIcon={<PlayArrow />}
          sx={{
            px: 6,
            py: 2,
            fontSize: '1.2rem',
            bgcolor: 'white',
            color: '#667eea',
            position: 'relative',
            zIndex: 1,
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.9)',
            },
          }}
        >
          Start Lottery
        </Button>
      </Paper>
    </Box>
  );
}

// The drawn ball pops up over the drum and its shell splits open to show the team
function RevealedBall({ selection, sizePx, holdSeconds }) {
  const isWinner = selection.pickNumber === 1;
  // Fit the pop + split inside short reveal holds so the team is always readable before it leaves
  const popSeconds = Math.min(0.4, holdSeconds * 0.25);
  const splitSeconds = Math.min(0.8, holdSeconds * 0.35);
  const shellColor = isWinner ? 'gold' : 'white';
  const halfShell = {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: '50%',
    bgcolor: shellColor,
    boxShadow: 'inset 0 0 18px rgba(0, 0, 0, 0.25)',
  };

  return (
    <Box
      data-testid="revealed-ball"
      sx={{
        position: 'relative',
        width: sizePx,
        height: sizePx,
        animation: `revealPop ${popSeconds}s ease-out both`,
        '@keyframes revealPop': {
          '0%': { transform: 'scale(0.2)', opacity: 0 },
          '100%': { transform: 'scale(1)', opacity: 1 },
        },
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          bgcolor: 'rgba(0, 0, 0, 0.8)',
          border: `4px solid ${shellColor}`,
          boxShadow: isWinner ? '0 0 40px 12px rgba(255, 215, 0, 0.7)' : '0 0 24px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.5,
          p: 2,
        }}
      >
        <TeamAvatar avatar={selection.avatar} teamName={selection.teamName} size={Math.round(sizePx * 0.32)} />
        <Typography sx={{ color: shellColor, fontWeight: 'bold', fontSize: `${Math.max(1.1, sizePx / 220)}rem` }}>
          {getPickLabel(selection.pickNumber)}
        </Typography>
        <Typography
          sx={{
            color: 'white',
            fontWeight: 'bold',
            textAlign: 'center',
            lineHeight: 1.2,
            maxWidth: sizePx * 0.8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontSize: `${Math.max(0.9, sizePx / 300)}rem`,
          }}
        >
          {selection.teamName}
        </Typography>
      </Box>
      <Box
        sx={{
          ...halfShell,
          top: 0,
          borderRadius: `${sizePx / 2}px ${sizePx / 2}px 0 0`,
          animation: `shellTop ${splitSeconds}s ease-in ${popSeconds}s both`,
          '@keyframes shellTop': {
            '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            '100%': { transform: 'translateY(-90%) rotate(-25deg)', opacity: 0 },
          },
        }}
      />
      <Box
        sx={{
          ...halfShell,
          bottom: 0,
          borderRadius: `0 0 ${sizePx / 2}px ${sizePx / 2}px`,
          animation: `shellBottom ${splitSeconds}s ease-in ${popSeconds}s both`,
          '@keyframes shellBottom': {
            '0%': { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            '100%': { transform: 'translateY(90%) rotate(20deg)', opacity: 0 },
          },
        }}
      />
    </Box>
  );
}

// One slot per pick in a single row (#1 on the left), filling in from the last pick on the right
function DraftBoard({ selections, totalTeams }) {
  const { avatarSize, gap, maxColumnPx, nameSize, labelSize } = getBoardSizes(totalTeams);
  const isCompact = totalTeams > COMPACT_BOARD_THRESHOLD;

  return (
    <Box
      data-testid="draft-board"
      sx={{
        display: 'grid',
        gridTemplateColumns: `repeat(${totalTeams}, minmax(0, ${maxColumnPx}px))`,
        justifyContent: 'center',
        gap: `${gap}px`,
        width: '100%',
        minHeight: avatarSize + (isCompact ? 40 : 64),
        px: { xs: 0, md: 1 },
        position: 'relative',
        zIndex: 1,
      }}
    >
      {selections.map(sel => {
        const isWinner = sel.pickNumber === 1;
        return (
          <Box
            key={`${sel.userId}-${sel.pickNumber}`}
            title={isCompact ? sel.teamName : undefined}
            sx={{
              gridColumn: sel.pickNumber,
              gridRow: 1,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0.5,
              py: isCompact ? 0.75 : 1,
              px: 0.5,
              borderRadius: 2,
              bgcolor: isWinner ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
              border: isWinner ? '2px solid gold' : 'none',
              animation: 'boardPop 0.5s ease-out both',
              '@keyframes boardPop': {
                '0%': { opacity: 0, transform: 'scale(0.3)' },
                '100%': { opacity: 1, transform: 'scale(1)' },
              },
            }}
          >
            <TeamAvatar avatar={sel.avatar} teamName={sel.teamName} size={avatarSize} />
            {!isCompact && (
              <Typography
                sx={{
                  color: 'white',
                  fontWeight: isWinner ? 'bold' : 'normal',
                  textAlign: 'center',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  fontSize: nameSize,
                }}
              >
                {sel.teamName}
              </Typography>
            )}
            <Typography
              sx={{
                color: isWinner ? 'gold' : 'rgba(255, 255, 255, 0.9)',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                fontSize: labelSize,
              }}
            >
              {isCompact ? (isWinner ? '🏆 #1' : `#${sel.pickNumber}`) : getPickLabel(sel.pickNumber)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function RevealStage({ results, onComplete, onSkip, leagueName }) {
  const { settings } = useSettings();
  const { pickIndex, phase, revealedCount, isComplete } = useRevealSequence(results.length, settings);
  // The drum grows to fill whatever space the headline and draft board leave
  const [drumAreaRef, drumArea] = useElementSize();
  const drumRadiusPx = drumArea ? fitDrumRadius(drumArea.width, drumArea.height) : DEFAULT_DRUM_RADIUS_PX;

  const current = results[pickIndex];
  const isWinnerPick = current.pickNumber === 1;
  const ballIsOut = phase === PHASES.REVEALING || phase === PHASES.PAUSING || isComplete;
  const showReveal = phase === PHASES.REVEALING || isComplete;

  // Call onComplete exactly once, even if the parent passes a new callback later
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  useEffect(() => {
    if (isComplete) onCompleteRef.current?.();
  }, [isComplete]);

  useWinnerConfetti(isWinnerPick && showReveal);

  const hiddenIds = results.slice(0, pickIndex).map(sel => sel.userId);
  if (ballIsOut) hiddenIds.push(current.userId);

  return (
    <Box sx={{ textAlign: 'center', height: '100%', position: 'relative' }}>
      <Paper
        elevation={8}
        sx={{
          ...REVEAL_BACKGROUND_SX,
          height: '100%',
          p: { xs: 1.5, md: 2 },
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Button
          variant={isComplete ? 'contained' : 'outlined'}
          onClick={onSkip}
          startIcon={<SkipNext />}
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 2,
            ...(isComplete
              ? {
                  bgcolor: 'gold',
                  color: '#222',
                  fontWeight: 'bold',
                  '&:hover': { bgcolor: '#ffe14d' },
                }
              : {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                  color: 'white',
                  bgcolor: 'rgba(0, 0, 0, 0.3)',
                  '&:hover': {
                    borderColor: 'rgba(255, 255, 255, 0.8)',
                    bgcolor: 'rgba(0, 0, 0, 0.5)',
                  },
                }),
          }}
        >
          {isComplete ? 'View Results' : 'Skip to Results'}
        </Button>

        <Typography
          variant="overline"
          sx={{
            color: 'rgba(255, 255, 255, 0.85)',
            fontWeight: 'bold',
            letterSpacing: 2,
            lineHeight: 1.8,
            mt: { xs: 5, md: 0 },
            position: 'relative',
            zIndex: 1,
            textShadow: '0 1px 3px #000',
          }}
        >
          The {leagueName} Draft Lottery
        </Typography>
        <Typography
          data-testid="reveal-headline"
          variant="h3"
          sx={{
            color: 'white',
            fontWeight: 'bold',
            minHeight: { xs: 40, md: 52 },
            fontSize: { xs: '1.75rem', md: '2.75rem' },
            px: { xs: 0, md: 24 },
            position: 'relative',
            zIndex: 1,
            textShadow: TEXT_OUTLINE,
          }}
        >
          {getHeadline(phase, current, results.length - pickIndex)}
        </Typography>

        <Box
          ref={drumAreaRef}
          sx={{
            flex: '1 1 0',
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1,
            my: 1,
          }}
        >
          <BallMachine
            teams={results}
            jetOn={phase === PHASES.MIXING || phase === PHASES.EJECTING}
            ejectId={phase === PHASES.EJECTING ? current.userId : null}
            riseId={isWinnerPick ? current.userId : null}
            hiddenIds={hiddenIds}
            drumRadiusPx={drumRadiusPx}
          >
            {showReveal && (
              <RevealedBall
                key={current.pickNumber}
                selection={current}
                sizePx={drumRadiusPx * 1.7}
                holdSeconds={settings.revealHoldSeconds}
              />
            )}
          </BallMachine>
        </Box>

        <DraftBoard selections={results.slice(0, revealedCount)} totalTeams={results.length} />
      </Paper>
    </Box>
  );
}

/**
 * Lottery reveal popup: a start screen, then the ball machine reveal.
 * @param {Object} props
 * @param {Array} props.results - Full lottery results from runNBALottery (worst pick first, winner last)
 * @param {boolean} props.animationStarted - Whether the reveal has started
 * @param {Function} props.onStart - Start the lottery
 * @param {Function} props.onComplete - Called once when the reveal finishes on its own
 * @param {Function} props.onSkip - Skip to (or, after completion, view) the results
 * @param {string} props.leagueName - Name of the league from Sleeper API
 */
export function SelectionAnimation({ results = [], animationStarted, onStart, onComplete, onSkip, leagueName = 'Fantasy Football' }) {
  // Worst pick first so the reveal ends on #1, whatever order the array arrives in
  const orderedResults = useMemo(() => [...results].sort((a, b) => b.pickNumber - a.pickNumber), [results]);

  if (!animationStarted) {
    return <StartScreen leagueName={leagueName} onStart={onStart} />;
  }
  // App sets the results before starting the reveal, so this is only a safety net
  if (orderedResults.length === 0) return null;

  return <RevealStage results={orderedResults} onComplete={onComplete} onSkip={onSkip} leagueName={leagueName} />;
}
