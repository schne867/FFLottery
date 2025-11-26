import React, { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
} from '@mui/material';
import { ExpandMore, CalendarToday, People } from '@mui/icons-material';
import { getDraftPicks, getDraft } from '../services/sleeperApi';
import { TeamAvatar } from './TeamAvatar';
import { TeamNameWithAvatar } from './TeamNameWithAvatar';

/**
 * Format player name from pick data
 */
function formatPlayerName(pick) {
  if (pick.player_id && pick.metadata) {
    return pick.metadata.first_name && pick.metadata.last_name
      ? `${pick.metadata.first_name} ${pick.metadata.last_name}`
      : pick.metadata.full_name || 'Unknown Player';
  }
  return pick.player_id || 'TBD';
}

/**
 * Format draft position
 */
function formatDraftPosition(pick) {
  return `R${pick.round} P${pick.pick_no}`;
}

/**
 * Format draft status
 */
function formatDraftStatus(draft) {
  if (draft.status === 'complete') {
    return { label: 'Complete', color: 'success' };
  }
  if (draft.status === 'in_progress') {
    return { label: 'In Progress', color: 'warning' };
  }
  return { label: 'Pending', color: 'default' };
}

/**
 * Group picks by team and sort by draft order
 */
function organizePicksByTeam(picks) {
  const teamPicks = {};
  
  // Sort picks by draft order (round, then pick number)
  const sortedPicks = [...picks].sort((a, b) => {
    if (a.round !== b.round) {
      return a.round - b.round;
    }
    return a.pick_no - b.pick_no;
  });
  
  // Group by team
  sortedPicks.forEach(pick => {
    const teamId = pick.picked_by;
    if (!teamPicks[teamId]) {
      teamPicks[teamId] = [];
    }
    teamPicks[teamId].push(pick);
  });
  
  return teamPicks;
}

/**
 * DraftHistory component for displaying draft pick history
 * @param {Object} props
 * @param {Array} props.drafts - Array of draft objects
 * @param {Object} props.teamsMap - Map of userId to team object
 */
export function DraftHistory({ drafts, teamsMap }) {
  const [expandedDraft, setExpandedDraft] = useState(null);
  const [draftPicks, setDraftPicks] = useState({});
  const [loading, setLoading] = useState({});
  const [errors, setErrors] = useState({});
  const [selectedTeamFilter, setSelectedTeamFilter] = useState({}); // { draftId: teamId or 'all' }

  const handleDraftExpand = useCallback(async (draftId, isExpanded) => {
    if (isExpanded && !draftPicks[draftId]) {
      setLoading(prev => ({ ...prev, [draftId]: true }));
      setErrors(prev => ({ ...prev, [draftId]: null }));

      try {
        const picks = await getDraftPicks(draftId);
        const draft = await getDraft(draftId);
        
        // Sort picks by round and pick number
        const sortedPicks = picks.sort((a, b) => {
          if (a.round !== b.round) {
            return a.round - b.round;
          }
          return a.pick_no - b.pick_no;
        });

        setDraftPicks(prev => ({
          ...prev,
          [draftId]: {
            picks: sortedPicks,
            draft,
          },
        }));
      } catch (error) {
        setErrors(prev => ({
          ...prev,
          [draftId]: error.message || 'Failed to load draft picks',
        }));
      } finally {
        setLoading(prev => ({ ...prev, [draftId]: false }));
      }
    }

    setExpandedDraft(isExpanded ? draftId : null);
    
    // Reset team filter when closing draft
    if (!isExpanded) {
      setSelectedTeamFilter(prev => {
        const updated = { ...prev };
        delete updated[draftId];
        return updated;
      });
    } else {
      // Set default filter to 'all' when opening draft
      setSelectedTeamFilter(prev => ({
        ...prev,
        [draftId]: 'all',
      }));
    }
  }, []);

  const handleTeamFilterChange = useCallback((draftId, teamId) => {
    setSelectedTeamFilter(prev => ({
      ...prev,
      [draftId]: teamId,
    }));
  }, []);

  if (!drafts || drafts.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Draft History
        </Typography>
        <Typography variant="body2" color="text.secondary">
          No drafts found for this league.
        </Typography>
      </Paper>
    );
  }

  // Sort drafts by season/year (most recent first)
  const sortedDrafts = [...drafts].sort((a, b) => {
    const yearA = a.season || 0;
    const yearB = b.season || 0;
    return yearB - yearA;
  });

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <CalendarToday sx={{ mr: 1 }} />
        <Typography variant="h6">
          Draft History
        </Typography>
      </Box>

      {sortedDrafts.map((draft) => {
        const picksData = draftPicks[draft.draft_id];
        const isLoading = loading[draft.draft_id];
        const error = errors[draft.draft_id];
        const isExpanded = expandedDraft === draft.draft_id;
        const status = formatDraftStatus(draft);

        // Organize picks by team
        const teamPicks = picksData && picksData.picks.length > 0
          ? organizePicksByTeam(picksData.picks)
          : {};

        // Get all team IDs and sort them (for consistent display order)
        const allTeamIds = Object.keys(teamPicks).sort((a, b) => {
          const teamA = teamsMap[a];
          const teamB = teamsMap[b];
          if (!teamA || !teamB) return 0;
          return teamA.teamName.localeCompare(teamB.teamName);
        });

        // Filter teams based on selection
        const filterValue = selectedTeamFilter[draft.draft_id] || 'all';
        const teamIds = filterValue === 'all' 
          ? allTeamIds 
          : allTeamIds.filter(id => id === filterValue);

        return (
          <Accordion
            key={draft.draft_id}
            expanded={isExpanded}
            onChange={(e, expanded) => handleDraftExpand(draft.draft_id, expanded)}
            sx={{ mb: 1 }}
          >
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                  {draft.season ? `${draft.season} Draft` : 'Draft'}
                  {draft.draft_type && ` - ${draft.draft_type}`}
                </Typography>
                <Chip
                  label={status.label}
                  color={status.color}
                  size="small"
                />
                {picksData && (
                  <Typography variant="body2" color="text.secondary">
                    {picksData.picks.length} picks
                  </Typography>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              {isLoading && (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              {picksData && picksData.picks.length > 0 && (
                <Box sx={{ mt: 2 }}>
                  {/* Team Filter Dropdown */}
                  <Box sx={{ mb: 2 }}>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                      <InputLabel id={`team-filter-label-${draft.draft_id}`}>
                        Filter by Team
                      </InputLabel>
                      <Select
                        labelId={`team-filter-label-${draft.draft_id}`}
                        id={`team-filter-${draft.draft_id}`}
                        value={selectedTeamFilter[draft.draft_id] || 'all'}
                        label="Filter by Team"
                        onChange={(e) => handleTeamFilterChange(draft.draft_id, e.target.value)}
                        startAdornment={<People sx={{ mr: 1, fontSize: 18 }} />}
                      >
                        <MenuItem value="all">All Teams</MenuItem>
                        {allTeamIds.map((teamId) => {
                          const team = teamsMap[teamId];
                          if (!team) return null;
                          return (
                            <MenuItem key={teamId} value={teamId}>
                              <TeamNameWithAvatar
                                avatar={team.avatar}
                                teamName={team.teamName}
                                variant="body2"
                                avatarSize={24}
                                spacing={1}
                              />
                            </MenuItem>
                          );
                        })}
                      </Select>
                    </FormControl>
                  </Box>

                  <Box sx={{ overflowX: 'auto' }}>
                    <Grid container spacing={2}>
                    {teamIds.map((teamId) => {
                      const team = teamsMap[teamId];
                      const picks = teamPicks[teamId] || [];
                      
                      return (
                        <Grid item xs={12} key={teamId}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                            {/* Team Name Column */}
                            <Box
                              sx={{
                                minWidth: 180,
                                maxWidth: 180,
                                p: 1,
                                bgcolor: 'background.default',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                              }}
                            >
                              <TeamNameWithAvatar
                                avatar={team?.avatar}
                                teamName={team?.teamName || 'Unknown Team'}
                                variant="subtitle2"
                                avatarSize={32}
                                spacing={1}
                                sx={{
                                  '& .MuiTypography-root': {
                                    fontWeight: 'bold',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  },
                                }}
                              />
                            </Box>

                            {/* Players Grid */}
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, flex: 1 }}>
                              {picks.map((pick, index) => (
                                <Card
                                  key={index}
                                  sx={{
                                    width: 140,
                                    height: 100,
                                    display: 'flex',
                                    flexDirection: 'column',
                                  }}
                                >
                                  <CardContent 
                                    sx={{ 
                                      p: 1.5, 
                                      flex: 1,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      '&:last-child': { pb: 1.5 } 
                                    }}
                                  >
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}
                                    >
                                      {formatDraftPosition(pick)}
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: 'medium',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        lineHeight: 1.2,
                                        flex: 1,
                                        fontSize: '0.875rem',
                                      }}
                                    >
                                      {formatPlayerName(pick)}
                                    </Typography>
                                    {(pick.metadata?.position || pick.position) && (
                                      <Typography
                                        variant="caption"
                                        color="primary"
                                        sx={{ 
                                          display: 'block', 
                                          mt: 0.5,
                                          fontSize: '0.7rem',
                                          fontWeight: 'bold',
                                        }}
                                      >
                                        {pick.metadata?.position || pick.position}
                                      </Typography>
                                    )}
                                  </CardContent>
                                </Card>
                              ))}
                              {picks.length === 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                                  No picks
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                    </Grid>
                  </Box>
                </Box>
              )}

              {picksData && picksData.picks.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                  No picks found for this draft.
                </Typography>
              )}
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Paper>
  );
}
