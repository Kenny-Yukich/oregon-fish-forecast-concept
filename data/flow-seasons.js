/* Rivers whose flow changes sharply when irrigation season starts or ends. During each window the water's page and
   short-list card carry a note, and a score with no live flow reading is capped at Fair, because the river can look
   nothing like the last report. With a live reading, the flow input shows the change itself.
   Dates are typical; the switch moves by a week or two with the year's water supply. */
window.ORFF_FLOW_SEASONS = {
  "crooked-river-bowman-dam": [
    {from: '04-01', to: '05-15', change: 'rise', note: 'Irrigation season is starting. Bowman Dam releases go up for the summer, so the tailwater can be high and fast for a while.'},
    {from: '10-01', to: '11-15', change: 'drop', note: 'Irrigation season is ending. Bowman Dam releases are cut for the winter, and the tailwater can drop to a trickle within days.'}
  ],
  "middle-deschutes-culver": [
    {from: '04-01', to: '05-15', change: 'drop', note: 'Irrigation season is starting. Canals in Bend take most of the river, so flows below Bend drop sharply.'},
    {from: '10-01', to: '11-15', change: 'rise', note: 'Irrigation season is ending. Canals in Bend shut off and that water stays in the river, so flows below Bend rise quickly.'}
  ]
};
