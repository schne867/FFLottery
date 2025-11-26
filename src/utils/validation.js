/**
 * Validation utilities
 */

/**
 * Validate Sleeper league ID format
 * @param {string} leagueId - League ID to validate
 * @returns {Object} Validation result with isValid and error message
 */
export function validateLeagueId(leagueId) {
  if (!leagueId || typeof leagueId !== 'string') {
    return {
      isValid: false,
      error: 'League ID must be a non-empty string',
    };
  }

  const trimmed = leagueId.trim();
  if (trimmed.length === 0) {
    return {
      isValid: false,
      error: 'Please enter a league ID',
    };
  }

  return {
    isValid: true,
    error: null,
  };
}


