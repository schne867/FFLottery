import React, { useState, useMemo, useCallback } from 'react';
import { 
  Card, 
  CardContent, 
  Box, 
  Typography, 
  TextField, 
  Collapse,
  IconButton,
} from '@mui/material';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { formatTeamRecord } from '../utils/teamUtils';
import { calculateTotalCombinations } from '../utils/combinations';
import { TeamNameWithAvatar } from './TeamNameWithAvatar';

/**
 * Format points to display
 */
function formatPoints(points) {
  if (points === null || points === undefined) return 'N/A';
  return points.toFixed(2);
}

/**
 * TeamCard component for displaying team information and combinations input
 * @param {Object} props
 * @param {Object} props.team - Team object
 * @param {number} props.combinations - Current combination count
 * @param {number} props.teamIndex - Index of team in sorted list (0 = worst)
 * @param {Array<number>} props.allCombinations - Array of all team combinations (for percentage calculation)
 * @param {boolean} props.isCustom - Whether custom mode is enabled (allows editing)
 * @param {Function} props.onCombinationsChange - Callback when combinations change (only used in custom mode)
 * @param {boolean} props.disabled - Whether the component is disabled
 */
export function TeamCard({ team, combinations, teamIndex, allCombinations = [], isCustom = false, onCombinationsChange, disabled }) {
  const [statsExpanded, setStatsExpanded] = useState(false);

  const toggleStatsExpanded = useCallback(() => {
    setStatsExpanded(prev => !prev);
  }, []);

  const handleCombinationsChange = useCallback((event) => {
    if (!isCustom || !onCombinationsChange) return;
    const value = event.target.value;
    const numValue = parseInt(value, 10) || 0;
    onCombinationsChange(team.userId, Math.max(0, numValue));
  }, [team.userId, isCustom, onCombinationsChange]);

  // Calculate percentage chance for this team (memoized)
  const percentage = useMemo(() => {
    const totalCombos = calculateTotalCombinations(allCombinations);
    return totalCombos > 0 && combinations > 0
      ? (combinations / totalCombos) * 100
      : 0;
  }, [allCombinations, combinations]);

  return (
    <Card>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Team Information (Left Side) */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TeamNameWithAvatar
              avatar={team.avatar}
              teamName={team.teamName}
              variant="subtitle1"
              avatarSize={32}
              spacing={1}
            />
            
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography variant="body2" color="text.secondary">
                Record: {formatTeamRecord(team)}
              </Typography>
              
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  '&:hover': { opacity: 0.7 },
                }}
                onClick={toggleStatsExpanded}
              >
                <Typography variant="caption" color="primary" sx={{ mr: 0.5 }}>
                  Team Stats
                </Typography>
                <IconButton size="small" sx={{ p: 0 }}>
                  {statsExpanded ? <ExpandLess /> : <ExpandMore />}
                </IconButton>
              </Box>
            </Box>

            {/* Expandable Team Stats */}
            <Collapse in={statsExpanded}>
              <Box sx={{ mt: 1, pl: 1, borderLeft: 2, borderColor: 'divider' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Points For: <strong>{formatPoints(team.pointsFor)}</strong>
                </Typography>
                {team.pointsAgainst !== undefined && team.pointsAgainst !== null && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Points Against: <strong>{formatPoints(team.pointsAgainst)}</strong>
                  </Typography>
                )}
                {team.pointsFor && team.pointsAgainst !== undefined && team.pointsAgainst !== null && (
                  <Typography variant="caption" color="text.secondary" display="block">
                    Point Differential: <strong>{formatPoints(team.pointsFor - team.pointsAgainst)}</strong>
                  </Typography>
                )}
              </Box>
            </Collapse>
          </Box>

          {/* Lottery Combinations Display/Input (Right Side) */}
          <Box sx={{ minWidth: 140 }}>
            {isCustom ? (
              <TextField
                fullWidth
                type="number"
                label="Combinations"
                value={combinations || ''}
                onChange={handleCombinationsChange}
                disabled={disabled}
                size="small"
                inputProps={{ min: 0, step: 1 }}
                helperText={
                  percentage > 0 
                    ? `${percentage.toFixed(1)}% chance`
                    : 'Higher = better'
                }
              />
            ) : (
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold' }}>
                  {combinations || 0}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {percentage > 0 
                    ? `${percentage.toFixed(1)}% chance`
                    : 'Combinations'}
                </Typography>
              </Box>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

