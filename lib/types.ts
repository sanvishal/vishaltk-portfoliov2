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
  image: string;
  description: string;
  about: string;
  link: string;
};

export type WorkItem = {
  company: string;
  role: string;
  period: string;
  bullets: string[];
};
