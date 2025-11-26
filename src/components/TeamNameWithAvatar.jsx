import React from 'react';
import { Box, Typography } from '@mui/material';
import { TeamAvatar } from './TeamAvatar';

/**
 * TeamNameWithAvatar component for displaying team name with avatar
 * @param {Object} props
 * @param {string} props.avatar - Avatar URL (can be null/undefined)
 * @param {string} props.teamName - Team name
 * @param {string} props.variant - Typography variant (default: 'body1')
 * @param {Object} props.sx - Additional sx props for container
 * @param {Object} props.avatarSx - Additional sx props for avatar
 * @param {string|number} props.avatarSize - Avatar size ('small', 'medium', 'large' or number)
 * @param {number} props.spacing - Gap between avatar and text (default: 1)
 */
export function TeamNameWithAvatar({
  avatar,
  teamName,
  variant = 'body1',
  sx = {},
  avatarSx = {},
  avatarSize = 'medium',
  spacing = 1,
  ...otherProps
}) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: spacing,
        ...sx,
      }}
      {...otherProps}
    >
      <TeamAvatar
        avatar={avatar}
        teamName={teamName}
        sx={avatarSx}
        size={avatarSize}
      />
      <Typography variant={variant} noWrap>
        {teamName || 'Unknown Team'}
      </Typography>
    </Box>
  );
}

