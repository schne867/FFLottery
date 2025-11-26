import React from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { TeamCard } from './TeamCard';
import { DragIndicator } from '@mui/icons-material';
import { Box } from '@mui/material';

/**
 * TeamCard that is both draggable and droppable - allows swapping between lottery and playoff
 * @param {Object} props - Same props as TeamCard
 */
export function DraggableAndDroppableTeamCard({ team, ...teamCardProps }) {
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

  // Combine both refs using a callback
  const setNodeRef = React.useCallback((node) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);

  const style = {
    transform: CSS.Translate.toString(dragTransform),
    opacity: isDragging ? 0.7 : isOver ? 0.7 : 1,
    transition: 'opacity 0.2s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
    >
      <Box
        sx={{
          position: 'relative',
        }}
      >
        {/* Drag handle */}
        <Box
          {...dragAttributes}
          {...dragListeners}
          sx={{
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            cursor: isDragging ? 'grabbing' : 'grab',
            color: 'text.secondary',
            paddingLeft: 1,
            paddingRight: 1,
            '&:hover': { color: 'primary.main' },
            '&:active': { cursor: 'grabbing' },
          }}
        >
          <DragIndicator />
        </Box>
        <TeamCard team={team} {...teamCardProps} />
      </Box>
    </div>
  );
}

