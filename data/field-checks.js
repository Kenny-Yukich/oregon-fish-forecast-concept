/* First-hand trip checks by the site owner. They stay in the background: a check moves the water's score up or
   down for 14 days (see assets/member-preview.js), but its wording is never shown on the site. The score breakdown
   only says that a field check was made, its date and a one-word result.
   - water: a guide water id, or a plain name for a water that is not in the guide yet (kept for the record only).
   - result: none (no fish), slow, fair, good or great.
   - conditions: short background notes, never displayed. */
window.ORFF_FIELD = {checks: [
  {date: '2026-10-16', water: 'crooked-river-bowman-dam', result: 'none', hours: 2, conditions: ['very low water, about 6 inches deep on average with a few holes to 4 feet']},
  {date: '2026-10-16', water: 'Deschutes River at Tumalo State Park', result: 'none', hours: 2, conditions: ['current too fast']}
]};
