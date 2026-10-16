import { ViewTransition } from "react";

/**
 * wraps a page's content so route changes read as moving through a book: into a project
 * the page turns left, back to the index it turns right. untyped navigations (browser back,
 * refresh) just swap. the header is pinned in css so it never slides.
 */
export function PageSlide({ children }: { children: React.ReactNode }) {
  const map = { "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" };
  return (
    <ViewTransition enter={map} exit={map} default="none">
      {children}
    </ViewTransition>
  );
}

/** a project's name, shared between the index row and the project page so one morphs into the other */
export function ProjectTitle({ slug, children }: { slug: string; children: React.ReactNode }) {
  return (
    <ViewTransition name={`title-${slug}`} share="morph" default="none">
      {children}
    </ViewTransition>
  );
}
