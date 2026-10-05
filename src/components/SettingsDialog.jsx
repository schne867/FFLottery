import React, { useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Slider,
  Tooltip,
  Typography,
} from '@mui/material';
import { Settings } from '@mui/icons-material';
import { useSettings } from '../settings/SettingsContext';
import { groupSettingDefinitions } from '../settings/settingsSchema';
import { estimateRevealSeconds } from '../utils/revealTiming';

const ANIMATION_GROUP = 'Lottery Animation';

function formatSettingValue(value, unit) {
  return `${Number(value.toFixed(2))}${unit}`;
}

/**
 * Gear button that opens the settings dialog. Sliders are generated from the settings registry.
 * @param {Object} props
 * @param {number} props.lotteryTeamCount - Teams currently in the lottery, used for the length estimate
 */
export function SettingsDialog({ lotteryTeamCount = 0 }) {
  const [open, setOpen] = useState(false);
  const { settings, updateSetting, resetSettings } = useSettings();

  return (
    <>
      <Tooltip title="Settings">
        <IconButton aria-label="Settings" onClick={() => setOpen(true)}>
          <Settings />
        </IconButton>
      </Tooltip>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Settings</DialogTitle>
        <DialogContent dividers>
          {groupSettingDefinitions().map(({ group, definitions }) => (
            <Box key={group} sx={{ mb: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                {group}
              </Typography>

              {definitions.map(definition => (
                <Box key={definition.key} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <Typography>{definition.label}</Typography>
                    <Typography data-testid={`setting-${definition.key}-value`} sx={{ fontWeight: 'bold' }}>
                      {formatSettingValue(settings[definition.key], definition.unit)}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {definition.description}
                  </Typography>
                  <Slider
                    aria-label={definition.label}
                    value={settings[definition.key]}
                    min={definition.min}
                    max={definition.max}
                    step={definition.step}
                    valueLabelDisplay="auto"
                    valueLabelFormat={value => formatSettingValue(value, definition.unit)}
                    onChange={(_, value) => updateSetting(definition.key, value)}
                  />
                </Box>
              ))}

              {group === ANIMATION_GROUP && (
                <Typography variant="body2" color="text.secondary" data-testid="reveal-estimate">
                  {lotteryTeamCount > 0
                    ? `≈ ${Math.round(estimateRevealSeconds(lotteryTeamCount, settings))}s for ${lotteryTeamCount} teams`
                    : 'Load a league to see how long the reveal will take.'}
                </Typography>
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={resetSettings}>Reset to defaults</Button>
          <Button variant="contained" onClick={() => setOpen(false)}>
            Done
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
