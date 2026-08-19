'use client';

import { useEffect, type DependencyList } from 'react';

/**
 * Scrolls the window to the top whenever any value in `deps` changes.
 *
 * For multi-step flows that swap between drastically different-height
 * views based on state (a wizard step, a builder "generating…"/result
 * stage, an order-confirmed screen): the browser doesn't reset scroll
 * position on a re-render, so when a tall view (e.g. a full form) collapses
 * into a much shorter one (e.g. a small spinner or confirmation message),
 * the same scroll offset can now land past the new content entirely --
 * showing the footer instead of the fresh content that just appeared.
 * Reported happening on Monte seu Buquê's "gerar ilustração" step, and the
 * same pattern exists anywhere else a step/stage swap changes page height
 * a lot (checkout confirmation, subscription wizard steps) -- used in all
 * three.
 */
export function useScrollToTopOnChange(deps: DependencyList) {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
    // deps is intentionally dynamic -- this hook exists precisely to
    // forward an arbitrary dependency list to useEffect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
