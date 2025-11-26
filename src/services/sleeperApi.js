/**
 * Sleeper API integration for Fantasy Football data
 * Documentation: https://docs.sleeper.app/
 */

import { SLEEPER_API, POINTS_AGAINST } from '../constants';

const REQUEST_TIMEOUT_MS = 10000; // 10 seconds

/**
 * Construct Sleeper avatar URL from avatar ID
 * @param {string|null|undefined} avatarId - Avatar ID from Sleeper API (or full URL)
 * @param {boolean} thumbnail - Whether to use thumbnail version (default: false)
 * @returns {string|null} Full avatar URL or null if avatarId is invalid
 */
export function getAvatarUrl(avatarId, thumbnail = false) {
  if (!avatarId || typeof avatarId !== 'string') {
    return null;
  }
  
  // If it's already a full URL, return it as-is
  if (avatarId.startsWith('http://') || avatarId.startsWith('https://')) {
    return avatarId;
  }
  
  // Construct URL from avatar ID
  const baseUrl = thumbnail 
    ? 'https://sleepercdn.com/avatars/thumbs'
    : 'https://sleepercdn.com/avatars';
  
  return `${baseUrl}/${avatarId}`;
}

/**
 * Fetch with timeout
 * @param {string} url - URL to fetch
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise<Response>} Fetch response
 */
async function fetchWithTimeout(url, timeout = REQUEST_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - please check your connection and try again');
    }
    throw error;
  }
}

/**
 * Fetch league information
 * @param {string} leagueId - The Sleeper league ID
 * @returns {Promise<Object>} League data
 * @throws {Error} If league fetch fails
 */
export async function getLeague(leagueId) {
  if (!leagueId || typeof leagueId !== 'string') {
    throw new Error('Invalid league ID provided');
  }

  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.LEAGUE(leagueId)}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('League not found. Please check the league ID and try again.');
      }
      throw new Error(`Failed to fetch league: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again');
    }
    console.error('Error fetching league:', error);
    throw error;
  }
}

/**
 * Fetch matchups for a specific week
 * @param {string} leagueId - The Sleeper league ID
 * @param {number} week - Week number
 * @returns {Promise<Array>} Array of matchup objects
 */
async function getWeekMatchups(leagueId, week) {
  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.LEAGUE_MATCHUPS(leagueId, week)}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      // Return empty array if week doesn't exist yet
      if (response.status === 404) {
        return [];
      }
      throw new Error(`Failed to fetch matchups for week ${week}`);
    }
    
    const matchups = await response.json();
    return Array.isArray(matchups) ? matchups : [];
  } catch (error) {
    // Return empty array for weeks that don't exist
    if (error.message.includes('404') || error.message.includes('not found')) {
      return [];
    }
    throw error;
  }
}

/**
 * Get current NFL week (if available) to optimize matchup fetching
 * @returns {Promise<number|null>} Current week number or null if unavailable
 */
async function getCurrentNFLWeek() {
  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.NFL_STATE()}`;
    const response = await fetchWithTimeout(url, 5000); // Shorter timeout for this call
    
    if (response.ok) {
      const state = await response.json();
      return state?.week || null;
    }
  } catch (error) {
    // Silently fail - we'll just fetch all weeks
  }
  return null;
}

/**
 * Calculate points against for all teams by fetching matchups
 * This is a lightweight calculation that only processes matchup data
 * @param {string} leagueId - The Sleeper league ID
 * @param {Object} league - League object (to get season info)
 * @returns {Promise<Object>} Map of roster_id to points against
 */
async function calculatePointsAgainst(leagueId, league) {
  const pointsAgainstMap = {};
  
  // Try to get current week to optimize (only fetch completed weeks)
  let maxWeek = POINTS_AGAINST.MAX_WEEKS;
  try {
    const currentWeek = await getCurrentNFLWeek();
    if (currentWeek && currentWeek > 0) {
      // Fetch up to current week + 1 (in case current week is still being played)
      maxWeek = Math.min(currentWeek + 1, POINTS_AGAINST.MAX_WEEKS);
    }
  } catch (error) {
    // Continue with max weeks if we can't get current week
  }
  
  // Fetch matchups for weeks (optimized to only fetch necessary weeks)
  const weekPromises = [];
  for (let week = 1; week <= maxWeek; week++) {
    weekPromises.push(getWeekMatchups(leagueId, week));
  }
  
  try {
    const allWeekMatchups = await Promise.all(weekPromises);
    
      // Process each week's matchups
      allWeekMatchups.forEach((weekMatchups) => {
        if (!Array.isArray(weekMatchups) || weekMatchups.length === 0) {
          return;
        }
        
        // Group matchups by matchup_id to find opponents
        const matchupGroups = {};
        weekMatchups.forEach(matchup => {
          const matchupId = matchup.matchup_id;
          if (matchupId === null || matchupId === undefined) {
            return; // Skip invalid matchups
          }
          if (!matchupGroups[matchupId]) {
            matchupGroups[matchupId] = [];
          }
          matchupGroups[matchupId].push(matchup);
        });
        
        // Calculate points against for each team
        Object.values(matchupGroups).forEach(matchups => {
          if (matchups.length === 2) {
            // Standard matchup: team1's points against = team2's points for
            const [team1, team2] = matchups;
            const team1RosterId = team1.roster_id;
            const team2RosterId = team2.roster_id;
            const team1Points = parseFloat(team1.points) || 0;
            const team2Points = parseFloat(team2.points) || 0;
            
            // Only add points if roster IDs are valid
            if (team1RosterId !== null && team1RosterId !== undefined) {
              pointsAgainstMap[team1RosterId] = (pointsAgainstMap[team1RosterId] || 0) + team2Points;
            }
            if (team2RosterId !== null && team2RosterId !== undefined) {
              pointsAgainstMap[team2RosterId] = (pointsAgainstMap[team2RosterId] || 0) + team1Points;
            }
          } else if (matchups.length === 1) {
            // Bye week or single team - no points against added for this week
            // Points against stays at current value (or 0 if not initialized)
          }
          // Handle cases with more than 2 teams (rare, but possible) - skip for now
        });
      });
  } catch (error) {
    console.warn('Error calculating points against, continuing without it:', error);
    // Return empty map if calculation fails
    return {};
  }
  
  return pointsAgainstMap;
}

/**
 * Fetch all teams in a league
 * @param {string} leagueId - The Sleeper league ID
 * @param {Object} league - Optional league object (if already fetched)
 * @returns {Promise<Array>} Array of team objects
 * @throws {Error} If teams fetch fails
 */
export async function getLeagueTeams(leagueId, league = null) {
  if (!leagueId || typeof leagueId !== 'string') {
    throw new Error('Invalid league ID provided');
  }

  try {
    // Fetch league info if not provided
    let leagueData = league;
    if (!leagueData) {
      try {
        leagueData = await getLeague(leagueId);
      } catch (error) {
        console.warn('Could not fetch league info, continuing without points against:', error);
      }
    }
    
    // Fetch users and rosters in parallel
    const usersUrl = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.LEAGUE_USERS(leagueId)}`;
    const rostersUrl = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.LEAGUE_ROSTERS(leagueId)}`;
    
    const [usersResponse, rostersResponse] = await Promise.all([
      fetchWithTimeout(usersUrl),
      fetchWithTimeout(rostersUrl),
    ]);
    
    if (!usersResponse.ok) {
      if (usersResponse.status === 404) {
        throw new Error('League not found. Please check the league ID and try again.');
      }
      throw new Error(`Failed to fetch teams: ${usersResponse.statusText}`);
    }
    
    if (!rostersResponse.ok) {
      throw new Error(`Failed to fetch rosters: ${rostersResponse.statusText}`);
    }
    
    const users = await usersResponse.json();
    const rosters = await rostersResponse.json();
    
    if (!Array.isArray(users) || !Array.isArray(rosters)) {
      throw new Error('Invalid data format received from API');
    }
    
    // Calculate points against from matchups (only if enabled)
    // Note: This requires fetching matchups for all weeks, so it's disabled by default
    // Set POINTS_AGAINST.ENABLED = true in constants to enable
    let pointsAgainstMap = {};
    if (POINTS_AGAINST.ENABLED && leagueData) {
      try {
        pointsAgainstMap = await calculatePointsAgainst(leagueId, leagueData);
      } catch (error) {
        console.warn('Could not calculate points against:', error);
        // Continue without points against
      }
    }
    
    // Combine user data with roster data
    const teams = users.map(user => {
      const roster = rosters.find(r => r.owner_id === user.user_id);
      const rosterId = roster?.roster_id;
      // Points against: use calculated value if available, otherwise null (not calculated)
      // Note: 0 is a valid value (team's opponents scored 0 total points)
      const pointsAgainst = rosterId !== null && rosterId !== undefined && pointsAgainstMap[rosterId] !== undefined
        ? pointsAgainstMap[rosterId]
        : null;
      
      return {
        userId: user.user_id,
        teamName: user.display_name || user.metadata?.team_name || `Team ${user.user_id}`,
        avatar: getAvatarUrl(user.avatar),
        wins: roster?.settings?.wins || 0,
        losses: roster?.settings?.losses || 0,
        ties: roster?.settings?.ties || 0,
        pointsFor: roster?.settings?.fpts || 0,
        pointsAgainst: pointsAgainst,
        totalPoints: roster?.settings?.fpts || 0,
        waiverPosition: roster?.settings?.waiver_position || null,
        waiverBudget: roster?.settings?.waiver_budget_used || null,
      };
    });
    
    if (teams.length === 0) {
      throw new Error('No teams found in this league');
    }
    
    return teams;
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again');
    }
    console.error('Error fetching teams:', error);
    throw error;
  }
}

/**
 * Fetch user information
 * @param {string} userId - The Sleeper user ID
 * @returns {Promise<Object>} User data
 * @throws {Error} If user fetch fails
 */
export async function getUser(userId) {
  if (!userId || typeof userId !== 'string') {
    throw new Error('Invalid user ID provided');
  }

  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.USER(userId)}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('User not found');
      }
      throw new Error(`Failed to fetch user: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again');
    }
    console.error('Error fetching user:', error);
    throw error;
  }
}

/**
 * Fetch all drafts for a league
 * @param {string} leagueId - The Sleeper league ID
 * @returns {Promise<Array>} Array of draft objects
 * @throws {Error} If drafts fetch fails
 */
export async function getLeagueDrafts(leagueId) {
  if (!leagueId || typeof leagueId !== 'string') {
    throw new Error('Invalid league ID provided');
  }

  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.LEAGUE_DRAFTS(leagueId)}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // Return empty array if no drafts found
      }
      throw new Error(`Failed to fetch drafts: ${response.statusText}`);
    }
    
    const drafts = await response.json();
    return Array.isArray(drafts) ? drafts : [];
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again');
    }
    console.error('Error fetching drafts:', error);
    throw error;
  }
}

/**
 * Fetch draft picks for a specific draft
 * @param {string} draftId - The Sleeper draft ID
 * @returns {Promise<Array>} Array of draft pick objects
 * @throws {Error} If draft picks fetch fails
 */
export async function getDraftPicks(draftId) {
  if (!draftId || typeof draftId !== 'string') {
    throw new Error('Invalid draft ID provided');
  }

  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.DRAFT_PICKS(draftId)}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        return []; // Return empty array if no picks found
      }
      throw new Error(`Failed to fetch draft picks: ${response.statusText}`);
    }
    
    const picks = await response.json();
    return Array.isArray(picks) ? picks : [];
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again');
    }
    console.error('Error fetching draft picks:', error);
    throw error;
  }
}

/**
 * Fetch draft details
 * @param {string} draftId - The Sleeper draft ID
 * @returns {Promise<Object>} Draft data
 * @throws {Error} If draft fetch fails
 */
export async function getDraft(draftId) {
  if (!draftId || typeof draftId !== 'string') {
    throw new Error('Invalid draft ID provided');
  }

  try {
    const url = `${SLEEPER_API.BASE_URL}${SLEEPER_API.ENDPOINTS.DRAFT(draftId)}`;
    const response = await fetchWithTimeout(url);
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Draft not found');
      }
      throw new Error(`Failed to fetch draft: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    if (error.message.includes('timeout') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error - please check your connection and try again');
    }
    console.error('Error fetching draft:', error);
    throw error;
  }
}

