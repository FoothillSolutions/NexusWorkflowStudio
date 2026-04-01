"use client";

import { useCallback, useEffect, useRef } from "react";
import {
  PANEL_MAX_HEIGHT_OFFSET_PX,
  PANEL_MAX_WIDTH_PX,
  PANEL_RESET_TRANSITION_DURATION_MS,
  PANEL_RESET_TRANSITION_FALLBACK_MS,
  PANEL_TOP_OFFSET_PX,
  PANEL_VIEWPORT_MARGIN_PX,
  VIEWPORT_PADDING_PX,
} from "./constants";

interface UseFloatingWorkflowGenPositionOptions {
  floating: boolean;
  collapsed: boolean;
}

interface Position {
  x: number;
  y: number;
}

const PANEL_RESET_TRANSITION = `transform ${PANEL_RESET_TRANSITION_DURATION_MS / 1000}s cubic-bezier(.4,0,.2,1)`;

export function useFloatingWorkflowGenPosition({
  floating,
  collapsed,
}: UseFloatingWorkflowGenPositionOptions) {
  const panelRef = useRef<HTMLDivElement>(null);
  const posRef = useRef<Position>({ x: 0, y: 0 });
  const dragStartRef = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const rafIdRef = useRef(0);

  const getViewportSize = useCallback(() => {
    if (typeof window === "undefined") {
      return { width: 0, height: 0 };
    }

    const visualViewport = window.visualViewport;
    return {
      width: visualViewport?.width ?? window.innerWidth,
      height: visualViewport?.height ?? window.innerHeight,
    };
  }, []);

  const clampPosition = useCallback((position: Position) => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return position;
    }

    const { width: viewportWidth, height: viewportHeight } = getViewportSize();
    const panelWidth = panelElement.offsetWidth;
    const panelHeight = panelElement.offsetHeight;

    const halfHorizontalTravel = Math.max(
      (viewportWidth - panelWidth) / 2 - VIEWPORT_PADDING_PX,
      0,
    );
    const minX = -halfHorizontalTravel;
    const maxX = halfHorizontalTravel;

    const minY = VIEWPORT_PADDING_PX - PANEL_TOP_OFFSET_PX;
    const maxY = Math.max(
      minY,
      viewportHeight - panelHeight - VIEWPORT_PADDING_PX - PANEL_TOP_OFFSET_PX,
    );

    return {
      x: Math.min(Math.max(position.x, minX), maxX),
      y: Math.min(Math.max(position.y, minY), maxY),
    };
  }, [getViewportSize]);

  const flush = useCallback(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }

    const nextPosition = clampPosition(posRef.current);
    posRef.current = nextPosition;
    panelElement.style.transform = `translate3d(calc(-50% + ${nextPosition.x}px), ${nextPosition.y}px, 0)`;
  }, [clampPosition]);

  const resetPosition = useCallback(() => {
    const panelElement = panelRef.current;
    if (!panelElement) {
      return;
    }

    if (posRef.current.x === 0 && posRef.current.y === 0) {
      return;
    }

    posRef.current = clampPosition({ x: 0, y: 0 });
    panelElement.style.transition = PANEL_RESET_TRANSITION;
    flush();

    const cleanup = () => {
      panelElement.style.transition = "";
      panelElement.removeEventListener("transitionend", cleanup);
    };

    panelElement.addEventListener("transitionend", cleanup);
    window.setTimeout(cleanup, PANEL_RESET_TRANSITION_FALLBACK_MS);
  }, [clampPosition, flush]);

  const handleDragStart = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) {
      return;
    }

    if ((event.target as HTMLElement).closest("button")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const panelElement = panelRef.current;
    if (panelElement) {
      panelElement.style.transition = "";
    }

    const { x, y } = posRef.current;
    dragStartRef.current = { mx: event.clientX, my: event.clientY, ox: x, oy: y };
    document.body.style.userSelect = "none";

    const onMove = (moveEvent: MouseEvent) => {
      posRef.current = clampPosition({
        x: dragStartRef.current.ox + (moveEvent.clientX - dragStartRef.current.mx),
        y: dragStartRef.current.oy + (moveEvent.clientY - dragStartRef.current.my),
      });
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(flush);
    };

    const onUp = () => {
      document.body.style.userSelect = "";
      cancelAnimationFrame(rafIdRef.current);
      flush();
      document.removeEventListener("mousemove", onMove, true);
      document.removeEventListener("mouseup", onUp, true);
    };

    document.addEventListener("mousemove", onMove, true);
    document.addEventListener("mouseup", onUp, true);
  }, [clampPosition, flush]);

  useEffect(() => {
    posRef.current = { x: 0, y: 0 };
    const panelElement = panelRef.current;
    if (panelElement) {
      panelElement.style.transition = "";
      requestAnimationFrame(() => {
        posRef.current = clampPosition({ x: 0, y: 0 });
        flush();
      });
    }
  }, [clampPosition, flush, floating]);

  useEffect(() => {
    if (!floating) {
      return;
    }

    requestAnimationFrame(flush);
  }, [collapsed, flush, floating]);

  useEffect(() => {
    if (!floating) {
      return;
    }

    const handleResize = () => {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(flush);
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
      cancelAnimationFrame(rafIdRef.current);
    };
  }, [flush, floating]);

  return {
    panelRef,
    handleDragStart,
    resetPosition,
    panelStyle: {
      top: PANEL_TOP_OFFSET_PX,
      left: "50%",
      transform: "translateX(-50%)",
      width: `min(${PANEL_MAX_WIDTH_PX}px, calc(100dvw - ${PANEL_VIEWPORT_MARGIN_PX}px))`,
      maxHeight: collapsed ? undefined : `calc(100dvh - ${PANEL_MAX_HEIGHT_OFFSET_PX}px)`,
      willChange: "transform" as const,
    },
  };
}

