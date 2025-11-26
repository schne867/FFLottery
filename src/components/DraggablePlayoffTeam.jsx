import React from 'react';
import { Box, Typography } from '@mui/material';
import { DragIndicator } from '@mui/icons-material';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TeamNameWithAvatar } from './TeamNameWithAvatar';

/**
 * Draggable playoff team component
 * @param {Object} props
 * @param {Object} props.team - Team object
 * @param {boolean} props.showCombinations - Whether to show "(0 combinations)" text
 */
export function DraggablePlayoffTeam({ team, showCombinations = false }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: team.userId,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        bgcolor: 'background.default',
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        cursor: isDragging ? 'grabbing' : 'grab',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'action.hover',
        },
      }}
    >
      <Box
        {...attributes}
        {...listeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          cursor: 'grab',
          color: 'text.secondary',
          '&:hover': { color: 'primary.main' },
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicator />
      </Box>
      <TeamNameWithAvatar
        avatar={team.avatar}
        teamName={team.teamName}
        variant="body2"
        avatarSize={24}
        spacing={0.5}
      />
      {showCombinations && (
        <Typography variant="caption" color="text.secondary">
          (0 combinations)
        </Typography>
      )}
    </Box>
  );
}

