/** Number of example prompts rendered in the floating workflow generator at once. */
export const VISIBLE_EXAMPLE_COUNT = 3;

/** Offset from the top viewport edge where the floating panel is anchored. */
export const PANEL_TOP_OFFSET_PX = 12;

/** Safe padding used when clamping the floating panel inside the viewport. */
export const VIEWPORT_PADDING_PX = 16;

/** Horizontal viewport margin reserved when sizing the floating panel width. */
export const PANEL_VIEWPORT_MARGIN_PX = 32;

/** Maximum width for the floating workflow generator panel. */
export const PANEL_MAX_WIDTH_PX = 520;

/** Bottom spacing reserved so the expanded panel never touches the viewport edge. */
export const PANEL_MAX_HEIGHT_OFFSET_PX = 140;

/** Fixed height for each example row to prevent layout jumps while examples stream in. */
export const EXAMPLE_ROW_HEIGHT_PX = 54;

/** Delay before focusing the prompt textarea after the panel opens. */
export const TEXTAREA_FOCUS_DELAY_MS = 100;

/** Duration of the snap-back transition when re-centering the floating panel. */
export const PANEL_RESET_TRANSITION_DURATION_MS = 200;

/** Fallback timeout for clearing panel reset transitions when transitionend does not fire. */
export const PANEL_RESET_TRANSITION_FALLBACK_MS = 250;

