/**
 * a company's name in running text, with its mark in front and a soft underline in its own
 * colour: quiet enough to read straight through. marks: shopify's and brevo's from simple
 * icons, pushowl's own app icon.
 */

const SHOPIFY = "M15.337 23.979l7.216-1.561s-2.604-17.613-2.625-17.73c-.018-.116-.114-.192-.211-.192s-1.929-.136-1.929-.136-1.275-1.274-1.439-1.411c-.045-.037-.075-.057-.121-.074l-.914 21.104h.023zM11.71 11.305s-.81-.424-1.774-.424c-1.447 0-1.504.906-1.504 1.141 0 1.232 3.24 1.715 3.24 4.629 0 2.295-1.44 3.76-3.406 3.76-2.354 0-3.54-1.465-3.54-1.465l.646-2.086s1.245 1.066 2.28 1.066c.675 0 .975-.545.975-.932 0-1.619-2.654-1.694-2.654-4.359-.034-2.237 1.571-4.416 4.827-4.416 1.257 0 1.875.361 1.875.361l-.945 2.715-.02.01zM11.17.83c.136 0 .271.038.405.135-.984.465-2.064 1.639-2.508 3.992-.656.213-1.293.405-1.889.578C7.697 3.75 8.951.84 11.17.84V.83zm1.235 2.949v.135c-.754.232-1.583.484-2.394.736.466-1.777 1.333-2.645 2.085-2.971.193.501.309 1.176.309 2.1zm.539-2.234c.694.074 1.141.867 1.429 1.755-.349.114-.735.231-1.158.366v-.252c0-.752-.096-1.371-.271-1.871v.002zm2.992 1.289c-.02 0-.06.021-.078.021s-.289.075-.714.21c-.423-1.233-1.176-2.37-2.508-2.37h-.115C12.135.209 11.669 0 11.265 0 8.159 0 6.675 3.877 6.21 5.846c-1.194.365-2.063.636-2.16.674-.675.213-.694.232-.772.87-.075.462-1.83 14.063-1.83 14.063L15.009 24l.927-21.166z";
const BREVO = "M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zM7.2 4.8h5.747c2.34 0 3.895 1.406 3.895 3.516 0 1.022-.348 1.862-1.09 2.588C17.189 11.812 18 13.22 18 14.785c0 2.86-2.64 5.016-6.164 5.016H7.199v-15zm2.085 1.952v5.537h.07c.233-.432.858-.796 2.249-1.226 2.039-.659 3.037-1.52 3.037-2.655 0-.998-.766-1.656-1.924-1.656H9.285zm4.87 5.266c-.766.385-1.67.748-2.76 1.11-1.229.387-2.11 1.386-2.11 2.407v2.315h2.365c2.387 0 4.149-1.34 4.149-3.155 0-1.067-.625-2.087-1.645-2.677z";

const BRANDS = {
  pushowl: {
    label: "Brevo PushOwl",
    href: "https://pushowl.com/",
    tint: "#0b996e",
    mark: (
      // brevo's mark with pushowl's owl tucked against it, the way the two are one company now
      <span className="flex items-center">
        <svg aria-hidden viewBox="0 0 24 24" className="size-[1.05em] fill-[#0b996e]">
          <path d={BREVO} />
        </svg>
        <img
          src="/images/brands/pushowl.png"
          alt=""
          className="-ml-[0.15em] size-[1.05em] rounded-[28%] ring-[1.5px] ring-paper"
        />
      </span>
    ),
  },
  shopify: {
    label: "Shopify",
    href: "https://www.shopify.com/",
    tint: "#5e8e3e",
    mark: (
      <svg aria-hidden viewBox="0 0 24 24" className="size-[1em] fill-[#95bf47]">
        <path d={SHOPIFY} />
      </svg>
    ),
  },
} as const;

export function Brand({ name }: { name: keyof typeof BRANDS }) {
  const b = BRANDS[name];
  return (
    <a
      href={b.href}
      target="_blank"
      rel="noopener noreferrer"
      style={{ "--brand": b.tint } as React.CSSProperties}
      className="group/brand inline-flex items-baseline gap-[0.3em] whitespace-nowrap"
    >
      <span className="self-center">{b.mark}</span>
      <span className="underline decoration-[color-mix(in_oklab,var(--brand)_55%,transparent)] decoration-[0.09em] underline-offset-[0.22em] transition-[text-decoration-color] group-hover/brand:decoration-(--brand)">
        {b.label}
      </span>
    </a>
  );
}
