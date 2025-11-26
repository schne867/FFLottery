import React from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
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
 * SelectionAnimation component for displaying current lottery selection
 * @param {Object} props
 * @param {Object} props.selection - Current selection object
 * @param {number} props.totalTeams - Total number of teams
 */
export function SelectionAnimation({ selection, totalTeams }) {
  if (!selection) return null;

  return (
    <Box sx={{ mb: 4, textAlign: 'center' }}>
      <Paper
        elevation={8}
        sx={{
          p: 4,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
        }}
      >
        <Typography variant="h4" gutterBottom>
          {getPositionLabel(selection.position, totalTeams, selection.pickNumber)}
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 'bold', mt: 2 }}>
          {selection.teamName}
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <TeamAvatar
            avatar={selection.avatar}
            teamName={selection.teamName}
            size={100}
          />
        </Box>
      </Paper>
      <LinearProgress sx={{ mt: 2 }} />
    </Box>
  );
}

