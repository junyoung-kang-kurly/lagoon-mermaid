export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

/** the modifier key label shown in the UI: ⌘ on Apple platforms, Ctrl elsewhere */
export const MOD = isMac ? '⌘' : 'Ctrl'
