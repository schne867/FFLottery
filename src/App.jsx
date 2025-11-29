import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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
  Dialog,
  IconButton,
} from '@mui/material';
import {
  Refresh,
  PlayArrow,
  Close,
} from '@mui/icons-material';
import { getLeagueTeams, getLeague, getLeagueDrafts } from './services/sleeperApi';
import { validateLeagueId } from './utils/validation';
import { sortTeamsByRecord, determinePlayoffAndLotteryTeams, formatTeamRecord } from './utils/teamUtils';
import { runNBALottery } from './utils/nbaLottery';
import { calculateTotalCombinations, getCombinationSet } from './utils/combinations';
import { LOTTERY } from './constants';
import { DndContext, pointerWithin, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { DraggableAndDroppableTeamCard } from './components/DraggableAndDroppableTeamCard';
import { DroppablePlayoffTeam } from './components/DroppablePlayoffTeam';
import { LotteryResults } from './components/LotteryResults';
import { SelectionAnimation } from './components/SelectionAnimation';
import { LeagueInfo } from './components/LeagueInfo';
import { DraftHistory } from './components/DraftHistory';
import { TeamNameWithAvatar } from './components/TeamNameWithAvatar';

function App() {
  const [leagueId, setLeagueId] = useState(() => {
    return sessionStorage.getItem('sleeperLeagueId') || '';
  });
  const [teams, setTeams] = useState([]);
  const [league, setLeague] = useState(null);
  const [drafts, setDrafts] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [combinationSet, setCombinationSet] = useState('NBA_6_TEAMS');
  const [lotterySlots, setLotterySlots] = useState([]); // Array of { slotId, combinations, teamId }
  const [isRunning, setIsRunning] = useState(false);
  const [showAnimation, setShowAnimation] = useState(false);
  const [animationStarted, setAnimationStarted] = useState(false);
  const [selections, setSelections] = useState([]);
  const [currentSelection, setCurrentSelection] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [teamsForLottery, setTeamsForLottery] = useState([]);
  const [confettiInterval, setConfettiInterval] = useState(null);
  const [fullLotteryResults, setFullLotteryResults] = useState([]);
  const skipAnimationRef = useRef(false);

  // Save league ID to session storage when it changes
  useEffect(() => {
    if (leagueId) {
      sessionStorage.setItem('sleeperLeagueId', leagueId);
    }
  }, [leagueId]);

  // Auto-load teams on mount if league ID exists in session storage
  const initialLeagueIdRef = useRef(sessionStorage.getItem('sleeperLeagueId'));
  useEffect(() => {
    if (initialLeagueIdRef.current) {
      handleLoadTeams();
    }
  }, []);

  // Configure drag and drop sensors (must always be called - React hooks rule)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor)
  );

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
    setLotterySlots([]); // Reset slots
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
      
      // Create slots based on selected distribution, then assign teams
      const set = LOTTERY.COMBINATION_SETS[combinationSet];
      const isLotteryOnly = set?.lotteryOnly || false;
      
      let teamsForSlots;
      if (isLotteryOnly) {
        // Only create slots for lottery teams (non-playoff teams)
        const { lotteryTeams } = determinePlayoffAndLotteryTeams(fetchedTeams, 6);
        teamsForSlots = lotteryTeams;
      } else {
        // Create slots for all teams
        teamsForSlots = sortTeamsByRecord(fetchedTeams);
      }
      
      // Create slots with combinations, then assign teams
      const comboArray = getCombinationSet(combinationSet, teamsForSlots.length);
      const slots = comboArray.map((combinations, index) => ({
        slotId: index,
        combinations: combinations || 1,
        teamId: teamsForSlots[index]?.userId || null,
      }));
      
      setLotterySlots(slots);
    } catch (err) {
      setError(err.message || 'Failed to load teams');
    } finally {
      setLoading(false);
    }
  }, [leagueId, combinationSet]);

  // Handle combination set change - recreate slots with new distribution
  const handleCombinationSetChange = useCallback((setKey) => {
    setCombinationSet(setKey);
    
    if (teams.length === 0) return;
    
    const set = LOTTERY.COMBINATION_SETS[setKey];
    const isLotteryOnly = set?.lotteryOnly || false;
    
    // Determine which teams should be in slots
    let teamsForSlots;
    if (isLotteryOnly) {
      const { lotteryTeams } = determinePlayoffAndLotteryTeams(teams, 6);
      teamsForSlots = lotteryTeams;
    } else {
      teamsForSlots = sortTeamsByRecord(teams);
    }
    
    // If switching to CUSTOM, preserve existing slot combinations if they exist
    if (setKey === 'CUSTOM' && lotterySlots.length > 0) {
      // Keep existing slots but update team assignments if needed
      const currentSlotTeamIds = new Set(lotterySlots.map(s => s.teamId).filter(Boolean));
      const availableTeamIds = new Set(teamsForSlots.map(t => t.userId));
      
      // Preserve slots, update team assignments
      const updatedSlots = lotterySlots.map((slot, index) => {
        // If current team is still available, keep it; otherwise assign from sorted list
        const currentTeamId = slot.teamId;
        let newTeamId = currentTeamId;
        
        if (!currentTeamId || !availableTeamIds.has(currentTeamId)) {
          // Find first available team not already in a slot
          const usedTeamIds = new Set(lotterySlots.slice(0, index).map(s => s.teamId).filter(Boolean));
          const availableTeam = teamsForSlots.find(t => !usedTeamIds.has(t.userId));
          newTeamId = availableTeam?.userId || null;
        }
        
        return { ...slot, teamId: newTeamId };
      });
      
      setLotterySlots(updatedSlots);
      return;
    }
    
    // For other distributions, recreate slots with new combinations
    const comboArray = getCombinationSet(setKey, teamsForSlots.length);
    
    // Try to preserve team assignments where possible
    const currentSlotMap = new Map(lotterySlots.map(s => [s.teamId, s.combinations]));
    const slots = comboArray.map((combinations, index) => {
      // Try to preserve team assignment if slot count matches
      const team = teamsForSlots[index];
      return {
        slotId: index,
        combinations: combinations || 1,
        teamId: team?.userId || null,
      };
    });
    
    setLotterySlots(slots);
  }, [teams, lotterySlots]);
  
  // Handle individual combination change (for custom mode) - update slot combinations
  const handleCombinationsChange = useCallback((slotId, value) => {
    setLotterySlots(prev => prev.map(slot => 
      slot.slotId === slotId 
        ? { ...slot, combinations: Math.max(0, value) }
        : slot
    ));
  }, []);

  // Handle drag end - swaps teams between slots (slots keep their combinations)
  // Ensures each team only exists in one place (lottery slot or playoff)
  // Swapping simply re-sorts where teams are located
  const handleDragEnd = useCallback((event) => {
    try {
      const { active, over } = event;
      
      if (!over || !active || active.id === over.id) return;
      
      // Safety check: ensure teams array is not empty
      if (!teams || teams.length === 0 || lotterySlots.length === 0) return;
      
      const draggedTeamId = active.id;
      const targetTeamId = over.id;
      
      // Find which slot contains the target team (if any)
      const targetSlotIndex = lotterySlots.findIndex(slot => slot.teamId === targetTeamId);
      
      // Check if dragged team is in a slot
      const draggedSlotIndex = lotterySlots.findIndex(slot => slot.teamId === draggedTeamId);
      
      // Swap teams - ensure each team only exists in one place
      // The playoffTeams memo will automatically update to show teams not in slots
      setLotterySlots(prev => {
        const newSlots = [...prev];
        
        if (draggedSlotIndex !== -1 && targetSlotIndex !== -1) {
          // Both teams are in slots - swap their positions
          const tempTeamId = newSlots[draggedSlotIndex].teamId;
          newSlots[draggedSlotIndex] = { ...newSlots[draggedSlotIndex], teamId: newSlots[targetSlotIndex].teamId };
          newSlots[targetSlotIndex] = { ...newSlots[targetSlotIndex], teamId: tempTeamId };
        } else if (draggedSlotIndex === -1 && targetSlotIndex !== -1) {
          // Dragged team is NOT in a slot (playoff team), target IS in a slot
          // Swap: put dragged team in target slot, target team moves to playoff (removed from slot)
          newSlots[targetSlotIndex] = { ...newSlots[targetSlotIndex], teamId: draggedTeamId };
          // Target team is now removed from slot and will automatically appear in playoffTeams
        } else if (draggedSlotIndex !== -1 && targetSlotIndex === -1) {
          // Dragged team IS in a slot, target is NOT (playoff team)
          // Swap: put target team in dragged slot, dragged team moves to playoff (removed from slot)
          newSlots[draggedSlotIndex] = { ...newSlots[draggedSlotIndex], teamId: targetTeamId };
          // Dragged team is now removed from slot and will automatically appear in playoffTeams
        }
        // If both teams are playoff teams (both indices -1), do nothing (no swap needed)
        
        return newSlots;
      });
    } catch (error) {
      console.error('Error in handleDragEnd:', error);
      // Don't break the app if drag fails
    }
  }, [teams, lotterySlots]);

  // Prepare lottery and show animation popup
  const handleRunLottery = useCallback(() => {
    if (teams.length === 0 || lotterySlots.length === 0) {
      setError('Please load teams first');
      return;
    }

    // Get teams assigned to slots with their slot combinations
    const teamsMap = new Map(teams.map(t => [t.userId, t]));
    const teamsWithCombinations = lotterySlots
      .map(slot => {
        const team = slot.teamId ? teamsMap.get(slot.teamId) : null;
        if (!team) return null;
        return {
          ...team,
          combinations: slot.combinations,
        };
      })
      .filter(Boolean);

    if (teamsWithCombinations.length === 0) {
      setError('No teams assigned to lottery slots. Please assign teams to slots.');
      return;
    }

    // Validate combinations
    const combinationValues = teamsWithCombinations.map(t => t.combinations);
    const total = calculateTotalCombinations(combinationValues);
    if (total === 0) {
      setError('Total combinations cannot be zero. Please set combination values.');
      return;
    }

    setError(null);
    setTeamsForLottery(teamsWithCombinations);
    setSelections([]);
    setCurrentSelection(null);
    setShowResults(false);
    setAnimationStarted(false);
    setShowAnimation(true);
    setFullLotteryResults([]);
    // Clear any existing confetti
    if (confettiInterval) {
      clearInterval(confettiInterval);
      setConfettiInterval(null);
    }
  }, [teams, lotterySlots, confettiInterval]);

  // Actually start the lottery animation
  const handleStartAnimation = useCallback(async () => {
    if (teamsForLottery.length === 0) return;

    setAnimationStarted(true);
    setIsRunning(true);
    skipAnimationRef.current = false; // Reset skip flag

    try {
      // Step 1: Run the lottery calculation FIRST (no delay) to get all results
      // Results are returned in order: [worst pick, ..., Pick #2, Pick #1 (winner)]
      const results = await runNBALottery(
        teamsForLottery,
        null, // No callback during calculation
        0    // No delay - calculate instantly
      );

      // Step 2: Store the full results for skip functionality
      setFullLotteryResults(results);
      
      // Step 3: Clear selections initially - don't show results section until animation completes or is skipped
      setSelections([]);
      setShowResults(false); // Keep results section hidden during animation

      // Step 3: Animate through the results sequentially
      // Results array is: [Pick #6, Pick #5, Pick #4, Pick #3, Pick #2, Pick #1]
      // We want to animate them in this order (worst first, winner last)
      const animationDuration = 1200; // Animation duration in ms (matches CSS animation)
      const delayBetweenPicks = 150; // Delay between each pick animation start (matches CSS delay)
      const staticDelayBetweenPicks = 300; // Static delay between picks (after avatar finishes rolling in)
      const lastPickDelay = 1000; // 2 second delay before the last pick
      
      for (let i = 0; i < results.length; i++) {
        // Check if skip was clicked - if so, break out of the loop
        if (skipAnimationRef.current) {
          break;
        }
        
        const selection = results[i];
        const animationDelay = i * delayBetweenPicks;
        const isLastPick = i === results.length - 1;
        
        // If this is the last pick, wait 2 seconds before starting its animation
        if (isLastPick) {
          await new Promise(resolve => setTimeout(resolve, lastPickDelay));
        } else if (i > 0) {
          // For all picks except the first, wait the static delay before starting the next animation
          await new Promise(resolve => setTimeout(resolve, staticDelayBetweenPicks));
        }
        
        // Check again after delay - skip might have been clicked during the delay
        if (skipAnimationRef.current) {
          break;
        }
        
        // Show all selections up to this point (avatars start rolling in)
        setSelections(results.slice(0, i + 1));
        
        // Wait for the avatar animation to complete before showing/updating the top display
        // Animation starts at animationDelay and takes animationDuration
        await new Promise(resolve => setTimeout(resolve, animationDelay + animationDuration));
        
        // Check again after animation delay
        if (skipAnimationRef.current) {
          break;
        }
        
        // Now show/update the top display after avatar has finished rolling in
        // This will replace the previous pick's display (if any)
        setCurrentSelection(selection);
        
        // If this is the last selection (Pick #1 - winner), trigger confetti
        if (isLastPick && selection.pickNumber === 1 && !skipAnimationRef.current) {
          // Import and trigger confetti
          const confetti = (await import('canvas-confetti')).default;
          const duration = 6000; // Doubled from 3000ms to 6000ms
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 10000 };

          function randomInRange(min, max) {
            return Math.random() * (max - min) + min;
          }

          const interval = setInterval(function() {
            const timeLeft = animationEnd - Date.now();

            if (timeLeft <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 50 * (timeLeft / duration);
            confetti({
              ...defaults,
              particleCount,
              origin: { x: randomInRange(0.1, 0.9), y: Math.random() - 0.2 }
            });
          }, 250);
          
          // Store the interval so we can clear it if user skips
          setConfettiInterval(interval);
        }
      }

      // Only update results if animation wasn't skipped
      if (!skipAnimationRef.current) {
        // Ensure all teams are displayed after animation completes
        setSelections(results);
        
        // Keep the #1 pick (winner) displayed at the top after animation completes
        const winner = results.find(r => r.pickNumber === 1);
        if (winner) {
          setCurrentSelection(winner);
        }
        
        // Animation complete - show final results
        setShowResults(true);
      }
    } catch (err) {
      setError(err.message || 'Lottery failed');
    } finally {
      setIsRunning(false);
      // Clear confetti interval when animation completes naturally
      if (confettiInterval) {
        clearInterval(confettiInterval);
        setConfettiInterval(null);
      }
      // Don't clear currentSelection - keep #1 pick displayed at top
      // Don't close animation automatically - wait for user to click exit
    }
  }, [teamsForLottery, confettiInterval]);

  // Handle reset
  const handleReset = useCallback(() => {
    setIsRunning(false);
    setShowAnimation(false);
    setAnimationStarted(false);
    setSelections([]);
    setCurrentSelection(null);
    setShowResults(false);
    setError(null);
    setTeamsForLottery([]);
  }, []);

  // Handle cancel animation
  const handleCancelAnimation = useCallback(() => {
    // Stop any ongoing confetti
    if (confettiInterval) {
      clearInterval(confettiInterval);
      setConfettiInterval(null);
    }
    setIsRunning(false);
    setShowAnimation(false);
    setAnimationStarted(false);
    setSelections([]);
    setCurrentSelection(null);
    setTeamsForLottery([]);
    setFullLotteryResults([]);
  }, [confettiInterval]);

  // Handle skip animation - immediately show results
  const handleSkipAnimation = useCallback(async () => {
    // Set skip flag to stop the animation loop
    skipAnimationRef.current = true;
    
    // Stop any ongoing confetti immediately
    if (confettiInterval) {
      clearInterval(confettiInterval);
      setConfettiInterval(null);
    }
    
    // Stop the animation loop
    setIsRunning(false);
    setShowAnimation(false);
    setAnimationStarted(false);
    
    // Use the full lottery results if available, otherwise calculate them
    let finalResults = fullLotteryResults.length > 0 ? fullLotteryResults : null;
    
    if (!finalResults && teamsForLottery.length > 0) {
      try {
        finalResults = await runNBALottery(
          teamsForLottery,
          null, // No callback
          0    // No delay - calculate instantly
        );
        setFullLotteryResults(finalResults);
      } catch (err) {
        setError(err.message || 'Lottery failed');
        return;
      }
    }
    
    // Set ALL results at once (not incrementally) - only if we have results
    if (finalResults && finalResults.length > 0) {
      setSelections(finalResults);
      
      // Set the winner as current selection
      const winner = finalResults.find(r => r.pickNumber === 1);
      if (winner) {
        setCurrentSelection(winner);
      }
      
      // Show results section immediately
      setShowResults(true);
    }
  }, [teamsForLottery, fullLotteryResults, confettiInterval, runNBALottery]);

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

  // Get teams assigned to slots (lottery teams)
  const teamsToDisplay = useMemo(() => {
    if (lotterySlots.length === 0 || teams.length === 0) return [];
    
    const teamsMap = new Map(teams.map(t => [t.userId, t]));
    return lotterySlots
      .map(slot => slot.teamId ? teamsMap.get(slot.teamId) : null)
      .filter(Boolean);
  }, [lotterySlots, teams]);

  // Get playoff teams (teams not assigned to any slot)
  // Always filters out teams that are in slots, regardless of mode
  const playoffTeams = useMemo(() => {
    if (teams.length === 0) return [];
    
    // Get teams that are currently in slots
    const slotTeamIds = new Set(lotterySlots.map(s => s.teamId).filter(Boolean));
    
    // Filter out teams that are in slots - these are the playoff teams
    return teams.filter(team => !slotTeamIds.has(team.userId));
  }, [teams, lotterySlots]);

  // Get combinations array from slots
  const allCombinationsArray = useMemo(() => {
    return lotterySlots.map(slot => slot.combinations);
  }, [lotterySlots]);
  
  // Get combination for a slot by index
  const getSlotCombination = useCallback((slotIndex) => {
    if (slotIndex < 0 || slotIndex >= lotterySlots.length) return 0;
    return lotterySlots[slotIndex].combinations;
  }, [lotterySlots]);

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
                placeholder="Enter Sleeper League ID - https://sleeper.com/leagues/****************"
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
            
            {/* Wrap both sections in DndContext to enable drag-and-drop */}
            {teams.length > 0 && (
              <DndContext
                sensors={sensors}
                collisionDetection={pointerWithin}
                onDragEnd={handleDragEnd}
              >
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Lottery Teams:
                </Typography>
                {lotterySlots.length > 0 && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {lotterySlots.map((slot, index) => {
                      const team = slot.teamId ? teams.find(t => t.userId === slot.teamId) : null;
                      if (!team) return null;
                      
                      return (
                        <DraggableAndDroppableTeamCard
                          key={slot.teamId}
                          team={team}
                          combinations={slot.combinations}
                          teamIndex={index}
                          allCombinations={allCombinationsArray}
                          isCustom={combinationSet === 'CUSTOM'}
                          onCombinationsChange={(value) => handleCombinationsChange(slot.slotId, value)}
                          disabled={isRunning}
                        />
                      );
                    })}
                  </Box>
                )}
                
                {/* Show playoff teams info if lottery-only mode or custom mode with 0-combination teams - displayed at bottom */}
                {playoffTeams.length > 0 && ((LOTTERY.COMBINATION_SETS[combinationSet]?.lotteryOnly) || combinationSet === 'CUSTOM') && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" gutterBottom>
                      Non-Lottery:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {playoffTeams.map((team) => (
                        <DroppablePlayoffTeam
                          key={team.userId}
                          team={team}
                          showCombinations={combinationSet === 'CUSTOM'}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </DndContext>
            )}
          </Box>
        )}

        {/* Run Lottery Button */}
        {teams.length > 0 && !showAnimation && selections.length === 0 && (
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

        {/* Lottery Animation - Popup Modal */}
        <Dialog
          open={showAnimation}
          maxWidth="lg"
          fullWidth
          onClose={() => {}} // Disable backdrop click closing - only exit button can close
          PaperProps={{
            sx: {
              background: 'transparent',
              boxShadow: 'none',
              maxHeight: '80vh',
              position: 'relative',
            },
          }}
          sx={{
            '& .MuiDialog-container': {
              alignItems: 'center',
              justifyContent: 'center',
            },
          }}
        >
          <SelectionAnimation
            selection={currentSelection}
            selections={selections}
            totalTeams={teamsForLottery.length}
            animationStarted={animationStarted}
            onStart={handleStartAnimation}
            onSkip={handleSkipAnimation}
            leagueName={league?.name || 'Fantasy Football'}
          />
        </Dialog>

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
