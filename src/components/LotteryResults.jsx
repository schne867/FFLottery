import React from 'react';
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Chip,
} from '@mui/material';
import { EmojiEvents, Refresh } from '@mui/icons-material';
import { TeamAvatar } from './TeamAvatar';

/**
 * Helper function to get position color for chip
 * Position 1 = worst pick, Position N = winner (1.01 pick)
 */
function getPositionColor(position, total) {
  if (position === total) return 'success'; // Winner (1.01 pick)
  if (position === 1) return 'error'; // Worst pick
  return 'default';
}

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
 * LotteryResults component for displaying lottery results
 * @param {Object} props
 * @param {Array} props.selections - Array of selected teams in order
 * @param {number} props.totalTeams - Total number of teams
 * @param {Function} props.onReset - Callback when reset button is clicked
 */
export function LotteryResults({ selections, totalTeams, onReset }) {
  // Reverse selections to show Pick #1 (winner) at top, then #2, #3, etc. downward
  // Selections come in as [worst pick, ..., Pick #2, Pick #1 (winner)]
  // We want to display as [Pick #1 (winner), Pick #2, ..., worst pick]
  const reversedSelections = [...selections].reverse();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5">
          <EmojiEvents sx={{ verticalAlign: 'middle', mr: 1 }} />
          Lottery Results
        </Typography>
        <Button
          variant="outlined"
          onClick={onReset}
          startIcon={<Refresh />}
        >
          Reset
        </Button>
      </Box>
      <List>
        {reversedSelections.map((selection, index) => (
          <ListItem
            key={selection.userId}
            sx={{
              mb: 1,
              bgcolor: index === 0 ? 'success.light' : 'background.paper',
              borderRadius: 2,
              border: index === 0 ? 2 : 0,
              borderColor: 'success.main',
            }}
          >
            <ListItemAvatar>
              <TeamAvatar
                avatar={selection.avatar}
                teamName={selection.teamName}
                size={40}
              />
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="h6">{selection.teamName}</Typography>
                  <Chip
                    label={getPositionLabel(selection.position, totalTeams, selection.pickNumber)}
                    color={getPositionColor(selection.position, totalTeams)}
                    size="small"
                  />
                </Box>
              }
              secondary={`Record: ${selection.wins}-${selection.losses}`}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
}

