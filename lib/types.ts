export type LinkType =
  | "github"
  | "website"
  | "blog"
  | "twitter"
  | "linkedin"
  | "dribbble"
  | "whatsapp"
  | "mail";

export type ProjectLink = {
  name?: string;
  type: LinkType;
  href: string;
};

export type Project = {
  slug: string;
  /** a couple of words for the index, e.g. "Markdown editor" */
  kind: string;
  name: string;
  image: string;
  description: string;
  accentColor: string;
  about: string[];
  images: { link: string; alt: string }[];
  links: ProjectLink[];
};

export type RandomProject = {
  name: string;
  /** a finished sentence or two */
  description: string;
  about: string;
  image?: string;
  /** a path on this site, or a full url that opens elsewhere */
  link: string;
};

export type WorkItem = {
  company: string;
  role: string;
  period: string;
  bullets: string[];
};
