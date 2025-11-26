import React from 'react';
import { Box } from '@mui/material';
import { useDroppable } from '@dnd-kit/core';

/**
 * Drop zone for playoff teams section
 */
export function PlayoffDropZone({ id, children, isOver }) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id,
  });

  return (
    <Box
      ref={setNodeRef}
      sx={{
        minHeight: 60,
        p: 2,
        bgcolor: isDroppableOver ? 'action.hover' : 'background.paper',
        border: 2,
        borderColor: isDroppableOver ? 'primary.main' : 'divider',
        borderStyle: isDroppableOver ? 'solid' : 'dashed',
        borderRadius: 1,
        transition: 'all 0.2s',
      }}
    >
      {children}
    </Box>
  );
}

