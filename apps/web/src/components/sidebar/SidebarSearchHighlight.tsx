import { useMemo } from "react";

import { buildSidebarSearchHighlightSegments } from "./sidebarSearchHighlightSegments";

interface SidebarSearchHighlightProps {
  className?: string;
  query: string;
  text: string;
}

export function SidebarSearchHighlight(props: SidebarSearchHighlightProps) {
  const segments = useMemo(
    () => buildSidebarSearchHighlightSegments(props.text, props.query),
    [props.query, props.text],
  );

  return (
    <span className={props.className}>
      {segments.map((segment) =>
        segment.highlighted ? (
          <mark
            key={segment.key}
            className="rounded-[3px] bg-amber-200/80 px-[1px] text-current dark:bg-amber-300/25"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={segment.key}>{segment.text}</span>
        ),
      )}
    </span>
  );
}
