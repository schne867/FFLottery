import React from 'react';
import { Box, Typography, Paper, Chip, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import { CalendarToday, People, EmojiEvents } from '@mui/icons-material';

/**
 * Format season year from league data
 */
function formatSeason(league) {
  if (league.season) {
    return league.season;
  }
  return new Date().getFullYear();
}

/**
 * Format league type
 */
function formatLeagueType(league) {
  if (league.settings?.type === 1) {
    return 'Redraft';
  }
  if (league.settings?.type === 2) {
    return 'Dynasty';
  }
  if (league.settings?.type === 3) {
    return 'Dynasty';
  }
  return 'Standard';
}

/**
 * Get available seasons from league and drafts
 */
function getAvailableSeasons(league, drafts = []) {
  const seasons = new Set();
  
  // Add current league season
  if (league?.season) {
    seasons.add(league.season);
  }
  
  // Add seasons from drafts
  drafts.forEach(draft => {
    if (draft.season) {
      seasons.add(draft.season);
    }
  });
  
  // If no seasons found, add current year
  if (seasons.size === 0) {
    seasons.add(new Date().getFullYear());
  }
  
  return Array.from(seasons).sort((a, b) => b - a); // Sort descending (newest first)
}

/**
 * LeagueInfo component for displaying league name and season information
 * @param {Object} props
 * @param {Object} props.league - League data object
 * @param {Array} props.drafts - Array of draft objects (for determining available seasons)
 * @param {number} props.selectedSeason - Currently selected season
 * @param {Function} props.onSeasonChange - Callback when season changes
 */
export function LeagueInfo({ league, drafts = [], selectedSeason, onSeasonChange }) {
  if (!league) return null;

  const availableSeasons = getAvailableSeasons(league, drafts);
  // Default to most recent season (first in sorted array) if selectedSeason is not set
  // or if selectedSeason is not in available seasons
  const mostRecentSeason = availableSeasons.length > 0 ? availableSeasons[0] : formatSeason(league);
  const currentSeason = (selectedSeason && availableSeasons.includes(selectedSeason)) 
    ? selectedSeason 
    : mostRecentSeason;

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3, background: 'linear-gradient(135deg, #667eea15 0%, #764ba215 100%)' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="h4" component="h2" gutterBottom>
            {league.name || 'Fantasy Football League'}
          </Typography>
          {league.settings?.name && league.settings.name !== league.name && (
            <Typography variant="body2" color="text.secondary">
              {league.settings.name}
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel id="season-select-label">Season</InputLabel>
            <Select
              labelId="season-select-label"
              id="season-select"
              value={currentSeason}
              label="Season"
              onChange={(e) => onSeasonChange && onSeasonChange(Number(e.target.value))}
            >
              {availableSeasons.map((season) => (
                <MenuItem key={season} value={season}>
                  {season} Season
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Chip
            icon={<People />}
            label={`${league.total_rosters || league.settings?.num_teams || 'N/A'} Teams`}
            color="primary"
            variant="outlined"
          />
          <Chip
            icon={<EmojiEvents />}
            label={formatLeagueType(league)}
            color="secondary"
            variant="outlined"
          />
          {league.settings?.playoff_teams && (
            <Chip
              label={`${league.settings.playoff_teams} Playoff Teams`}
              size="small"
              variant="outlined"
            />
          )}
        </Box>

        {league.settings?.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {league.settings.description}
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

