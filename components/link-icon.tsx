import { Globe, Link as LinkIcon, NotebookPen, type LucideProps } from "lucide-react";
import { FiDribbble, FiGithub, FiLinkedin, FiTwitter } from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import type { LinkType } from "@/lib/types";

/** feather glyphs for the brands (lucide dropped them), lucide for everything else */
export function SocialGlyph({ type, ...props }: { type: LinkType } & LucideProps) {
  const size = typeof props.size === "number" ? props.size : 20;
  const shared = { size, strokeWidth: props.strokeWidth ?? 2.5, className: props.className };
  switch (type) {
    case "github":
      return <FiGithub {...shared} />;
    case "twitter":
      return <FiTwitter {...shared} />;
    case "linkedin":
      return <FiLinkedin {...shared} />;
    case "dribbble":
      return <FiDribbble {...shared} />;
    case "whatsapp":
      return <FaWhatsapp {...shared} />;
    case "blog":
      return <NotebookPen {...props} />;
    case "website":
      return <Globe {...props} />;
    default:
      return <LinkIcon {...props} />;
  }
}
