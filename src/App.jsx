import React, { useState, useCallback, useMemo } from 'react';
import {
  Container,
  Paper,
  Typography,
  TextField,
  Button,
  Box,
  Grid,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Refresh,
  PlayArrow,
} from '@mui/icons-material';
import { getLeagueTeams, getLeague, getLeagueDrafts } from './services/sleeperApi';
import { validateLeagueId } from './utils/validation';
import { initializeDefaultCombinations, sortTeamsByRecord, determinePlayoffAndLotteryTeams } from './utils/teamUtils';
import { runNBALottery } from './utils/nbaLottery';
import { calculateTotalCombinations, getCombinationSet } from './utils/combinations';
import { LOTTERY } from './constants';
import { TeamCard } from './components/TeamCard';
import { LotteryResults } from './components/LotteryResults';
import { SelectionAnimation } from './components/SelectionAnimation';
import { LeagueInfo } from './components/LeagueInfo';
import { DraftHistory } from './components/DraftHistory';
import { TeamNameWithAvatar } from './components/TeamNameWithAvatar';

function App() {
  const [leagueId, setLeagueId] = useState('');
  const [teams, setTeams] = useState([]);
  const [league, setLeague] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [combinations, setCombinations] = useState({});
  const [combinationSet, setCombinationSet] = useState('NBA_6_TEAMS');
  const [isRunning, setIsRunning] = useState(false);
  const [selections, setSelections] = useState([]);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [showResults, setShowResults] = useState(false);

  // Load teams from Sleeper API
  const handleLoadTeams = useCallback(async () => {
    const validation = validateLeagueId(leagueId);
    if (!validation.isValid) {
      setError(validation.error);
      return;
    }

    setLoading(true);
    setError(null);
    setTeams([]);
    setLeague(null);
    setDrafts([]);
    setCombinations({});
    setIsRunning(false);
    setSelections([]);
    setCurrentSelection(null);
    setShowResults(false);

    try {
      // Fetch league info first (needed for points against calculation)
      const fetchedLeague = await getLeague(leagueId.trim()).catch(() => null);
      
      // Fetch teams and drafts in parallel (pass league to teams for points against calc)
      const [fetchedTeams, fetchedDrafts] = await Promise.all([
        getLeagueTeams(leagueId.trim(), fetchedLeague),
        getLeagueDrafts(leagueId.trim()).catch(() => []), // Return empty array if drafts fail
      ]);

      setLeague(fetchedLeague);
      setTeams(fetchedTeams);
      setDrafts(fetchedDrafts || []);
      
      // Set selected season to most recent available season
      // Get all available seasons from league and drafts
      const seasons = new Set();
      if (fetchedLeague?.season) {
        seasons.add(fetchedLeague.season);
      }
      (fetchedDrafts || []).forEach(draft => {
        if (draft.season) {
          seasons.add(draft.season);
        }
      });
      
      // Sort seasons descending (newest first) and set to most recent
      const sortedSeasons = Array.from(seasons).sort((a, b) => b - a);
      if (sortedSeasons.length > 0) {
        setSelectedSeason(sortedSeasons[0]);
      } else {
        // Fallback to current year if no seasons found
        setSelectedSeason(new Date().getFullYear());
      }
      
      // Initialize combinations based on selected set
      const set = LOTTERY.COMBINATION_SETS[combinationSet];
      const isLotteryOnly = set?.lotteryOnly || false;
      
      if (isLotteryOnly) {
        // Only assign combinations to lottery teams (non-playoff teams)
        const { lotteryTeams } = determinePlayoffAndLotteryTeams(fetchedTeams, 6);
        const numLotteryTeams = lotteryTeams.length;
        const comboArray = getCombinationSet(combinationSet, numLotteryTeams);
        const initialCombinations = {};
        lotteryTeams.forEach((team, index) => {
          initialCombinations[team.userId] = comboArray[index] || 1;
        });
        setCombinations(initialCombinations);
      } else {
        // Assign combinations to all teams
        const numTeams = fetchedTeams.length;
        const comboArray = getCombinationSet(combinationSet, numTeams);
        const sortedTeams = sortTeamsByRecord(fetchedTeams);
        const initialCombinations = {};
        sortedTeams.forEach((team, index) => {
          initialCombinations[team.userId] = comboArray[index] || 1;
        });
        setCombinations(initialCombinations);
      }
    } catch (err) {
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [leagueId, combinationSet]);

  // Handle combination set change
  const handleCombinationSetChange = useCallback((setKey) => {
    setCombinationSet(setKey);
    
    if (teams.length === 0) return;
    
    const set = LOTTERY.COMBINATION_SETS[setKey];
    const isLotteryOnly = set?.lotteryOnly || false;
    
    // If switching to CUSTOM and combinations are empty, initialize with NBA style
    if (setKey === 'CUSTOM') {
      const numTeams = teams.length;
      const comboArray = getCombinationSet('NBA_12_TEAMS', numTeams);
      const sortedTeams = sortTeamsByRecord(teams);
      const currentTotal = calculateTotalCombinations(Object.values(combinations));
      
      // Only initialize if combinations are empty or all zero
      if (currentTotal === 0 || Object.keys(combinations).length === 0) {
        const newCombinations = {};
        sortedTeams.forEach((team, index) => {
          newCombinations[team.userId] = comboArray[index] || 1;
        });
        setCombinations(newCombinations);
      }
      // Otherwise keep existing custom combinations
      return;
    }
    
    // For lottery-only sets, only assign to lottery teams
    if (isLotteryOnly) {
      const { lotteryTeams } = determinePlayoffAndLotteryTeams(teams, 6);
      const numLotteryTeams = lotteryTeams.length;
      const comboArray = getCombinationSet(setKey, numLotteryTeams);
      const newCombinations = {};
      lotteryTeams.forEach((team, index) => {
        newCombinations[team.userId] = comboArray[index] || 1;
      });
      setCombinations(newCombinations);
      return;
    }
    
    // For non-custom, non-lottery-only sets, apply the distribution to all teams
    const numTeams = teams.length;
    const comboArray = getCombinationSet(setKey, numTeams);
    const sortedTeams = sortTeamsByRecord(teams);
    const newCombinations = {};
    sortedTeams.forEach((team, index) => {
      newCombinations[team.userId] = comboArray[index] || 1;
    });
    setCombinations(newCombinations);
  }, [teams, combinations]);
  
  // Handle individual combination change (for custom mode)
  const handleCombinationsChange = useCallback((userId, value) => {
    setCombinations(prev => ({
      ...prev,
      [userId]: value,
    }));
  }, []);


  // Run lottery
  const handleRunLottery = useCallback(async () => {
    if (teams.length === 0) {
      setError('Please load teams first');
      return;
    }

    // Get teams to use for lottery (lottery teams only if lotteryOnly mode)
    // In custom mode, exclude teams with 0 combinations
    const set = LOTTERY.COMBINATION_SETS[combinationSet];
    const isLotteryOnly = set?.lotteryOnly || false;
    
    let teamsForLottery;
    if (isLotteryOnly) {
      const { lotteryTeams } = determinePlayoffAndLotteryTeams(teams, 6);
      teamsForLottery = lotteryTeams;
    } else if (combinationSet === 'CUSTOM') {
      // In custom mode, only include teams with > 0 combinations
      teamsForLottery = sortTeamsByRecord(teams).filter(team => {
        const teamCombos = combinations[team.userId] || 0;
        return teamCombos > 0;
      });
    } else {
      teamsForLottery = sortTeamsByRecord(teams);
    }

    const teamsWithCombinations = teamsForLottery.map(team => ({
      ...team,
      combinations: combinations[team.userId] || 0,
    }));

    // Validate combinations
    const combinationValues = teamsWithCombinations.map(t => t.combinations);
    const total = calculateTotalCombinations(combinationValues);
    if (total === 0) {
      setError('Total combinations cannot be zero. Please set combination values.');
      return;
    }

    setError(null);
    setIsRunning(true);
    setSelections([]);
    setCurrentSelection(null);
    setShowResults(false);

    try {
      const results = await runNBALottery(
        teamsWithCombinations,
        (selected, displayPosition, pickNumber) => {
          // selected is the team object, displayPosition is for UI, pickNumber is the actual pick
          setCurrentSelection({ 
            ...selected, 
            position: displayPosition,
            pickNumber 
          });
        },
        1500
      );

      setSelections(results);
      setShowResults(true);
    } catch (err) {
      setError(err.message || 'Lottery failed');
    } finally {
      setIsRunning(false);
      setCurrentSelection(null);
    }
  }, [teams, combinations]);

  // Handle reset
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setSelections([]);
    setCurrentSelection(null);
    setShowResults(false);
    setError(null);
  }, []);

  // Handle error dismiss
  const handleErrorDismiss = useCallback(() => {
    setError(null);
  }, []);

  // Handle season change
  const handleSeasonChange = useCallback((season) => {
    setSelectedSeason(season);
    // Note: For now, we're only showing the current season's data
    // In the future, this could trigger a reload of data for the selected season
    // when Sleeper API supports historical season data fetching
  }, []);

  // Create teams map for draft history
  const teamsMap = useMemo(() => {
    const map = {};
    teams.forEach(team => {
      map[team.userId] = team;
    });
    return map;
  }, [teams]);

  // Determine which teams to show based on combination set
  const set = LOTTERY.COMBINATION_SETS[combinationSet];
  const isLotteryOnly = set?.lotteryOnly || false;
  
  // Memoize teams to display (lottery teams only if lotteryOnly, otherwise all teams sorted worst to best)
  // In custom mode, separate teams with 0 combinations (playoff teams) from teams with > 0 combinations
  const teamsToDisplay = useMemo(() => {
    if (isLotteryOnly && teams.length > 0) {
      const { lotteryTeams } = determinePlayoffAndLotteryTeams(teams, 6);
      return lotteryTeams;
    }
    
    // In custom mode, filter out teams with 0 combinations (they'll be shown as playoff teams)
    if (combinationSet === 'CUSTOM' && teams.length > 0) {
      return sortTeamsByRecord(teams).filter(team => {
        const teamCombos = combinations[team.userId] || 0;
        return teamCombos > 0;
      });
    }
    
    return sortTeamsByRecord(teams);
  }, [teams, isLotteryOnly, combinationSet, combinations]);

  // Memoize playoff teams for display
  // In custom mode, these are teams with 0 combinations
  const playoffTeams = useMemo(() => {
    if (isLotteryOnly && teams.length > 0) {
      const { playoffTeams: playoff } = determinePlayoffAndLotteryTeams(teams, 6);
      return playoff;
    }
    
    // In custom mode, show teams with 0 combinations as playoff teams
    if (combinationSet === 'CUSTOM' && teams.length > 0) {
      return sortTeamsByRecord(teams).filter(team => {
        const teamCombos = combinations[team.userId] || 0;
        return teamCombos === 0;
      });
    }
    
    return [];
  }, [teams, isLotteryOnly, combinationSet, combinations]);

  // Memoize all combinations array to avoid recalculating for each TeamCard
  const allCombinationsArray = useMemo(() => {
    return teamsToDisplay.map(t => combinations[t.userId] || 0);
  }, [teamsToDisplay, combinations]);

  const appContent = (
    <Container maxWidth="lg" sx={{ py: 4 }}>
        <Paper elevation={3} sx={{ p: 4, background: 'rgba(255, 255, 255, 0.95)' }}>
        {/* League Information */}
        {league && (
          <LeagueInfo
            league={league}
            drafts={drafts}
            selectedSeason={selectedSeason}
            onSeasonChange={handleSeasonChange}
          />
        )}

        {/* League ID Input */}
        <Box sx={{ mb: 4 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Sleeper League ID"
                value={leagueId}
                onChange={(e) => setLeagueId(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !loading && !isRunning) {
                    handleLoadTeams();
                  }
                }}
                placeholder="Enter your Sleeper league ID"
                disabled={loading || isRunning}
                error={!!error && !loading}
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <Button
                fullWidth
                variant="contained"
                size="large"
                onClick={handleLoadTeams}
                disabled={loading || isRunning}
                startIcon={loading ? <CircularProgress size={20} /> : <Refresh />}
              >
                {loading ? 'Loading...' : 'Load Teams'}
              </Button>
            </Grid>
          </Grid>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={handleErrorDismiss}>
            {error}
          </Alert>
        )}

        {/* Teams and Combinations */}
        {teams.length > 0 && (
          <Box sx={{ mb: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h5">
                Set Lottery Combinations
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 250 }}>
                  <InputLabel id="combination-set-label">Combination Distribution</InputLabel>
                  <Select
                    labelId="combination-set-label"
                    id="combination-set-select"
                    value={combinationSet}
                    label="Combination Distribution"
                    onChange={(e) => handleCombinationSetChange(e.target.value)}
                    disabled={isRunning}
                  >
                    {Object.keys(LOTTERY.COMBINATION_SETS).map((key) => (
                      <MenuItem key={key} value={key}>
                        {LOTTERY.COMBINATION_SETS[key].name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Typography variant="body2" color="text.secondary">
                  Total: {calculateTotalCombinations(allCombinationsArray)} / {LOTTERY.TOTAL_COMBINATIONS}
                </Typography>
              </Box>
            </Box>
            
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
              {isLotteryOnly ? 'Lottery Teams (Non-Playoff):' : combinationSet === 'CUSTOM' ? 'Lottery Teams:' : 'All Teams:'}
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {teamsToDisplay.map((team, index) => (
                <TeamCard
                  key={team.userId}
                  team={team}
                  combinations={combinations[team.userId] || 0}
                  teamIndex={index}
                  allCombinations={allCombinationsArray}
                  isCustom={combinationSet === 'CUSTOM'}
                  onCombinationsChange={handleCombinationsChange}
                  disabled={isRunning}
                />
              ))}
            </Box>
            
            {/* Show playoff teams info if lottery-only mode or custom mode with 0-combination teams - displayed at bottom */}
            {playoffTeams.length > 0 && (isLotteryOnly || combinationSet === 'CUSTOM') && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Playoff Teams (Not Eligible for Lottery):
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {playoffTeams.map((team) => (
                    <Box
                      key={team.userId}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        p: 1,
                        bgcolor: 'background.default',
                        borderRadius: 1,
                        border: '1px solid',
                        borderColor: 'divider',
                      }}
                    >
                      <TeamNameWithAvatar
                        avatar={team.avatar}
                        teamName={team.teamName}
                        variant="body2"
                        avatarSize={24}
                        spacing={0.5}
                      />
                    </Box>
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        )}

        {/* Run Lottery Button */}
        {teams.length > 0 && !isRunning && selections.length === 0 && (
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleRunLottery}
              startIcon={<PlayArrow />}
              sx={{ px: 4, py: 1.5 }}
            >
              Run Lottery
            </Button>
          </Box>
        )}

        {/* Current Selection Animation */}
        {isRunning && (
          <SelectionAnimation
            selection={currentSelection}
            totalTeams={teams.length}
          />
        )}

        {/* Results */}
        {showResults && selections.length > 0 && (
          <LotteryResults
            selections={selections}
            totalTeams={teams.length}
            onReset={handleReset}
          />
        )}

        {/* Draft History */}
        {teams.length > 0 && drafts.length > 0 && (
          <Box sx={{ mt: 4 }}>
            <DraftHistory drafts={drafts} teamsMap={teamsMap} />
          </Box>
        )}
      </Paper>
    </Container>
  );

  return appContent;
}

export default App;
