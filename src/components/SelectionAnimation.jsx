import React from 'react';
import { Box, Paper, Typography, Button } from '@mui/material';
import { PlayArrow, SkipNext } from '@mui/icons-material';
import { TeamAvatar } from './TeamAvatar';

/**
 * Helper function to get position label
 * position = display position (1 = worst, N = winner)
 * pickNumber = actual pick number (1 = winner, N = worst) - optional, calculated if not provided
 */
function getPositionLabel(position, total, pickNumber = null) {
  // If pickNumber is provided, use it directly
  if (pickNumber !== null && pickNumber !== undefined) {
    if (pickNumber === 1) return '🏆 Pick #1';
    return `Pick #${pickNumber}`;
  }
  
  // Otherwise calculate from display position (backward compatibility)
  if (position === total) return '🏆 Pick #1';
  if (position === 1) return `Pick #${total}`;
  const calculatedPickNumber = total - position + 1;
  return `Pick #${calculatedPickNumber}`;
}

/**
 * SelectionAnimation component for displaying lottery animation
 * @param {Object} props
 * @param {Object} props.selection - Current selection object (null if not started)
 * @param {Array} props.selections - Array of all selections made so far (worst pick first, winner last)
 * @param {number} props.totalTeams - Total number of teams
 * @param {boolean} props.animationStarted - Whether the animation has started
 * @param {Function} props.onStart - Callback to start the animation
 * @param {Function} props.onClose - Callback to close/cancel the animation
 * @param {Function} props.onSkip - Callback to skip the animation and show results
 * @param {string} props.leagueName - Name of the league from Sleeper API
 */
export function SelectionAnimation({ selection, selections = [], totalTeams, animationStarted, onStart, onClose, onSkip, leagueName = 'Fantasy Football' }) {
  // Show start button if animation hasn't started
  if (!animationStarted) {
    return (
      <Box sx={{ textAlign: 'center', p: 4, position: 'relative' }}>
        <Paper
          elevation={8}
          sx={{
            p: 6,
            backgroundImage: 'url(/istockphoto-2167499398-612x612.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            color: 'white',
            minHeight: '50vh',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
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
              textShadow: `
                -2px -2px 0 #000,
                2px -2px 0 #000,
                -2px 2px 0 #000,
                2px 2px 0 #000,
                0 0 4px #000,
                0 0 4px #000
              `,
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

  // Sort selections by pickNumber descending to ensure worst pick (highest pickNumber) is first
  // This ensures the animation order is always correct regardless of how the array was built
  const allSelections = selections.length > 0 
    ? [...selections].sort((a, b) => b.pickNumber - a.pickNumber) // Sort descending: Pick #6 first, Pick #1 last
    : [];

  // Dynamically calculate avatar size and card dimensions based on number of teams
  // More teams = smaller avatars to fit on screen, fewer teams = larger avatars
  const getDynamicSizes = (numTeams) => {
    if (numTeams <= 6) {
      return { avatarSize: 100, cardWidth: 140, gap: 16 };
    } else if (numTeams <= 10) {
      return { avatarSize: 80, cardWidth: 120, gap: 12 };
    } else if (numTeams <= 14) {
      return { avatarSize: 60, cardWidth: 100, gap: 10 };
    } else {
      return { avatarSize: 50, cardWidth: 85, gap: 8 };
    }
  };

  const { avatarSize, cardWidth, gap } = getDynamicSizes(totalTeams);
  const spacing = cardWidth + gap;

  return (
    <Box sx={{ textAlign: 'center', p: 3, position: 'relative' }}>
      <Paper
        elevation={8}
        sx={{
          p: 5,
          backgroundImage: 'url(/istockphoto-2167499398-612x612.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          color: 'white',
          minHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
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
        }}
      >
        {/* Current selection display - always present to reserve space */}
        <Box sx={{ mb: 4, position: 'relative', zIndex: 1, minHeight: 120 }}>
          {selection ? (
            <>
              <Typography 
                variant="h3" 
                gutterBottom
                sx={{
                  color: 'white',
                  textShadow: `
                    -2px -2px 0 #000,
                    2px -2px 0 #000,
                    -2px 2px 0 #000,
                    2px 2px 0 #000,
                    0 0 4px #000,
                    0 0 4px #000
                  `,
                }}
              >
                {getPositionLabel(selection.position, totalTeams, selection.pickNumber)}
              </Typography>
              <Typography 
                variant="h2" 
                sx={{ 
                  fontWeight: 'bold', 
                  mt: 2,
                  color: 'white',
                  textShadow: `
                    -2px -2px 0 #000,
                    2px -2px 0 #000,
                    -2px 2px 0 #000,
                    2px 2px 0 #000,
                    0 0 4px #000,
                    0 0 4px #000
                  `,
                }}
              >
                {selection.teamName}
              </Typography>
            </>
          ) : null}
        </Box>

        {/* All teams rolling in from left to right */}
        <Box 
          sx={{ 
            display: 'flex',
            flexDirection: 'row-reverse',
            flexWrap: 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            alignContent: 'flex-start',
            gap: `${gap}px`,
            mt: 4,
            minHeight: 300,
            pb: 2,
            px: 2,
            width: '100%',
            position: 'relative',
            zIndex: 1,
          }}
        >
          {allSelections.map((sel, index) => {
            // Animation delay: first item (index 0) animates first, last item animates last
            // Array is already sorted: [Pick #6, Pick #5, Pick #4, Pick #3, Pick #2, Pick #1]
            // We want Pick #6 (worst) at the rightmost position, each subsequent pick to the left
            // When wrapping, new items should start at the right edge of the new row
            const animationDelay = index * 0.15;
            
            return (
            <Box
              key={`${sel.userId}-${sel.pickNumber}`}
              sx={{
                animation: 'rollInFromLeft 1.2s ease-out forwards',
                animationDelay: `${animationDelay}s`,
                opacity: 0,
                flexShrink: 0,
                width: cardWidth,
                '@keyframes rollInFromLeft': {
                  '0%': {
                    opacity: 0,
                    transform: 'translateX(-100vw) rotate(-180deg) scale(0.3)',
                  },
                  '100%': {
                    opacity: 1,
                    transform: 'translateX(0) rotate(0deg) scale(1)',
                  },
                },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 1,
                  p: 2,
                  borderRadius: 2,
                  bgcolor: sel.pickNumber === 1 ? 'rgba(255, 255, 255, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  border: sel.pickNumber === 1 ? '2px solid gold' : 'none',
                  width: cardWidth,
                  flexShrink: 0,
                }}
              >
                <TeamAvatar
                  avatar={sel.avatar}
                  teamName={sel.teamName}
                  size={avatarSize}
                />
                <Typography 
                  variant={totalTeams <= 6 ? "h6" : totalTeams <= 10 ? "subtitle1" : "body2"}
                  sx={{ 
                    color: 'white', 
                    fontWeight: sel.pickNumber === 1 ? 'bold' : 'normal',
                    textAlign: 'center',
                    maxWidth: cardWidth - 16,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    fontSize: totalTeams <= 6 ? '1rem' : totalTeams <= 10 ? '0.9rem' : '0.75rem',
                  }}
                >
                  {sel.teamName}
                </Typography>
                <Typography 
                  variant={totalTeams <= 6 ? "h5" : totalTeams <= 10 ? "h6" : "subtitle1"}
                  sx={{ 
                    color: sel.pickNumber === 1 ? 'gold' : 'rgba(255, 255, 255, 0.9)', 
                    fontWeight: 'bold',
                    fontSize: totalTeams <= 6 ? '1.5rem' : totalTeams <= 10 ? '1.2rem' : '1rem',
                  }}
                >
                  {getPositionLabel(sel.position, totalTeams, sel.pickNumber)}
                </Typography>
              </Box>
            </Box>
            );
          })}
        </Box>

        {/* Skip button - bottom center of animation window */}
        {animationStarted && (
          <Box 
            sx={{ 
              mt: 'auto',
              pt: 4,
              display: 'flex',
              justifyContent: 'center',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <Button
              variant="outlined"
              onClick={onSkip}
              startIcon={<SkipNext />}
              sx={{
                px: 4,
                py: 1.5,
                fontSize: '1rem',
                borderColor: 'rgba(255, 255, 255, 0.5)',
                color: 'white',
                bgcolor: 'rgba(0, 0, 0, 0.3)',
                '&:hover': {
                  borderColor: 'rgba(255, 255, 255, 0.8)',
                  bgcolor: 'rgba(0, 0, 0, 0.5)',
                },
              }}
            >
              Skip to Results
            </Button>
          </Box>
        )}

      </Paper>
    </Box>
  );
}

