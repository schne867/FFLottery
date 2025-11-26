import React from 'react';
import { Box, Typography } from '@mui/material';
import { DragIndicator } from '@mui/icons-material';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TeamNameWithAvatar } from './TeamNameWithAvatar';

/**
 * Playoff team component that is both draggable and droppable
 * @param {Object} props
 * @param {Object} props.team - Team object
 * @param {boolean} props.showCombinations - Whether to show "(0 combinations)" text
 */
export function DroppablePlayoffTeam({ team, showCombinations = false }) {
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    transform: dragTransform,
    isDragging,
  } = useDraggable({
    id: team.userId,
  });

  const {
    setNodeRef: setDropRef,
    isOver,
  } = useDroppable({
    id: team.userId,
  });

  // Combine both refs using a callback (same as lottery team)
  const setNodeRef = React.useCallback((node) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);

  const style = {
    transform: CSS.Translate.toString(dragTransform),
    opacity: isDragging ? 0.7 : isOver ? 0.7 : 1,
    transition: 'opacity 0.2s', // Only transition opacity, not transform
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
    >
      <Box
        {...dragAttributes}
        {...dragListeners}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          p: 1,
          bgcolor: 'background.default',
          borderRadius: 1,
          border: '1px solid',
          borderColor: isOver ? 'primary.main' : 'divider',
          cursor: isDragging ? 'grabbing' : 'grab',
          '&:hover': {
            borderColor: 'primary.main',
            bgcolor: 'action.hover',
          },
        }}
      >
      <Box
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
    </div>
  );
}

