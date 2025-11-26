import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { TeamCard } from './TeamCard';

/**
 * Droppable wrapper for TeamCard - allows playoff teams to be dropped on lottery teams
 * @param {Object} props - Same props as TeamCard, plus isOver for visual feedback
 */
export function DroppableTeamCard({ team, ...teamCardProps }) {
  const { setNodeRef, isOver } = useDroppable({
    id: team.userId,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        opacity: isOver ? 0.7 : 1,
        transition: 'opacity 0.2s',
      }}
    >
      <TeamCard team={team} {...teamCardProps} />
    </div>
  );
}

