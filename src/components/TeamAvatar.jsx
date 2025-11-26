import React from 'react';
import { Avatar } from '@mui/material';

/**
 * Get the first letter of a team name for fallback avatar
 */
function getTeamInitial(teamName) {
  if (!teamName || typeof teamName !== 'string') {
    return '?';
  }
  const trimmed = teamName.trim();
  return trimmed.length > 0 ? trimmed[0].toUpperCase() : '?';
}

/**
 * TeamAvatar component that displays team avatar with letter fallback
 * @param {Object} props
 * @param {string} props.avatar - Avatar URL (can be null/undefined)
 * @param {string} props.teamName - Team name for fallback letter
 * @param {Object} props.sx - Additional sx props for Avatar component
 * @param {string} props.size - Size prop ('small', 'medium', 'large') or number
 */
export function TeamAvatar({ avatar, teamName, sx = {}, size = 'medium', ...otherProps }) {
  const initial = getTeamInitial(teamName);
  
  // Determine size values
  let sizeProps = {};
  if (typeof size === 'string') {
    // Use Material-UI size prop
    sizeProps = {};
  } else if (typeof size === 'number') {
    // Custom size
    sizeProps = { width: size, height: size };
  }

  // Always include initial as fallback (shows if image fails to load)
  return (
    <Avatar
      src={avatar || undefined}
      alt={teamName}
      sx={{
        ...sizeProps,
        bgcolor: avatar ? undefined : 'primary.main',
        color: avatar ? undefined : 'primary.contrastText',
        ...sx,
      }}
      {...otherProps}
    >
      {initial}
    </Avatar>
  );
}

