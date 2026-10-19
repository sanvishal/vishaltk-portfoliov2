import type { LinkType, Project, RandomProject, WorkItem } from "./types";

export const site = {
  name: "Vishal TK",
  role: "Design engineer",
  tagline: "Design engineer. Interfaces, tools and the odd drawing made of maths.",
  // shown in the footer as a live clock
  timezone: "Asia/Kolkata",
  place: "India",
  url: "https://www.vishaltk.dev",
  ogImage: "https://vishaltk.dev/images/og.jpg",
  twitterHandle: "@tk_vishal_tk",
  resume:
    "https://drive.google.com/file/d/1aeQrSqX_UNhQQo9CkrfAGRfUYnA1pWUU/view?usp=share_link",
  // the avatar has always linked here. it stays a secret.
  avatarLink: "https://www.youtube.com/watch?v=22rCPuPh1Gw",
  consoleNote:
    "like my portfolio? hit me up on twitter @tk_vishal_tk, let's have a chat ~",
};

export const socials: { type: LinkType; href: string; label: string }[] = [
  { type: "twitter", href: "https://twitter.com/tk_vishal_tk", label: "twitter" },
  { type: "github", href: "https://github.com/sanvishal", label: "github" },
  { type: "dribbble", href: "https://dribbble.com/tkvishal", label: "dribbble" },
  { type: "linkedin", href: "https://www.linkedin.com/in/tkvishal/", label: "linkedin" },
];

export const iconColors: Record<LinkType, string> = {
  github: "#e6e6e6",
  dribbble: "#ea4c89",
  linkedin: "#0a94e0",
  whatsapp: "#25D366",
  mail: "#EA4335",
  twitter: "#1da1f2",
  website: "#EA4335",
  blog: "#3466f6",
};

export const projects: Project[] = [
  {
    slug: "wrighter",
    kind: "Markdown editor",
    name: "Wrighter",
    image: "/images/wrighter.png",
    description: "A markdown editor that keeps loose thoughts as bites",
    accentColor: "#4242ff",
    about: [
      'wrighter is a modern WYSIWYM #tag based markdown editor on the web. wrighter\'s "bites" help you manage unorganised thoughts which you can later use while writing, you can use wrighter to even publish your blogs or use it just as an editor without signing up!',
      `Wrighter is a project that I've been wanting to make for a very long time, I've used almost all the popular markdown editors out there. They lacked the most important features that "I" needed the most.`,
      "I wanted a distraction-free markdown editor on the web that is usable in any form factor. Most markdown editors are either too cluttered or too minimal(hard to find). There are only two extremes. I wanted an app that sits in the middle, it should be distraction-free while also having the ability to quickly provide all of the application's functionality with a few key taps.",
      "wrighter aims to be that + some more, it is currently open source and contributions are welcome!",
    ],
    images: [
      { link: "/images/wrighter/wr-1.png", alt: "All of wrighter's features" },
      { link: "/images/wrighter/wr-2.gif", alt: "wrighter's command bar and editor" },
      { link: "/images/wrighter/wr-3.gif", alt: "wrighter's powerful command bar" },
      { link: "/images/wrighter/wr-4.png", alt: "wrighter's bite functionality" },
      { link: "/images/wrighter/wr-5.gif", alt: "wrighter's bite functionality in wrights" },
    ],
    links: [
      { type: "website", name: "Visit Wrighter", href: "https://wrighter.vercel.app/" },
      { type: "github", name: "View Source", href: "https://github.com/sanvishal/wrighter" },
      {
        type: "blog",
        name: "Read About it",
        href: "https://vishaltk.hashnode.dev/introducing-wrighter-a-powerful-markdown-blogger-a-writing-companion",
      },
    ],
  },
  {
    slug: "teenytools",
    kind: "Toolbox",
    name: "TeenyTools",
    image: "/images/teenytools.png",
    description: "The small tools designers who code use daily, in one tab",
    accentColor: "#E27055",
    about: [
      "A quick, all-in-one toolbox of small tools for designers and designers who code. teenytools has many frequently used tools by developers every day, it provides both the ease of access on commonly used tools and a depth of customizations on those tools too.",
      `I use small websites like coolors, blobmaker, and other small tools literally every single day to do repetitive tasks like making color palettes, creating graphics, and other design-related tasks. I even have them bookmarked for easier access. BUT still, I don't like switching tabs among 20 other tabs that I have open already. on the other hand, I LOVE the UX of Raycast, which allows me to navigate anywhere or execute a small script with just simple commands.`,
      "I wanted an app that does all this in a single tab, that is fast and easy to access, that's how teenytools was born",
      "teenytools is built with CRA, ChakraUI, Framer motion and a ton of research on colors and color spaces",
    ],
    images: [
      { link: "/images/teenytools/tt-1.gif", alt: "A gif of teenytools functionalities" },
      {
        link: "/images/teenytools/tt-3.png",
        alt: "An image showing teenytools powerful color editor or explorer",
      },
      { link: "/images/teenytools/tt-2.gif", alt: "A gif showing teenytools command palette" },
      {
        link: "/images/teenytools/tt-4.gif",
        alt: "A gif showing teenytools quick actions from command palette",
      },
      {
        link: "/images/teenytools/tt-5.png",
        alt: "An image showing teenytools generative functionality to generate organic patterns",
      },
    ],
    links: [
      { type: "website", name: "Visit TeenyTools", href: "https://teenytools.netlify.app/" },
      { type: "github", name: "View Source", href: "https://github.com/sanvishal/teenytools" },
      {
        type: "blog",
        name: "Read About it",
        href: "https://vishaltk.hashnode.dev/teenytools-a-quick-all-in-one-toolbox-of-small-tools-for-designers-and-designers-who-code",
      },
    ],
  },
  {
    slug: "diddohub",
    kind: "Hackathon winner",
    name: "DiddoHub",
    image: "/images/diddohub.png",
    description: "Learning paths made from YouTube videos",
    accentColor: "#226FEE",
    about: [
      'Usually, whenever I get an idea with a broad scope, the first thing I do is sit on it for a couple of weeks(procrastination is a good thing sometimes :P). I get started on the design, colors, typography, and the UI first before getting into the "gotchas" of actually executing the idea and making it so that I can be as creative as I want with the design decisions. One such idea is diddohub.',
      '"There is a high saturation of free learning content(youtube videos, blogs). It becomes hard to choose a correct way to learn! diddohub solves it by providing a platform to curate learning content in a enjoyable way for curators and learners. Curators could use diddohub as a tool to keep track of their learning progress/take notes and later publish them for others to learn and follow their path." was the initial pitch for diddohub. You can know more about diddohub on the slide deck.',
      "The MVP itself was a huge task to accomplish by myself, coincidentally, my company announced a 36 hour internal hackathon. I immediately formed a team of 6(ARTEMIS) and pitched the idea to my team mates. All of them loved it! We built a M-MVP(most-most viable product) and presented to everyone. All of the judges liked it and we won the hackathon 🥳🎉",
      "Unintentionally, I learned a lot about Product Design, how to fail faster, how to not eat junk food at 4 AM in the morning, and how to pick the correct genre of songs to code faster 🎵",
      "If you ever have a wild idea that you think is good, participate in a hackathon. It is one of the best way to test the product market fit. If it doesn't work, you get free hackathon swags and fun experiences, if it works you get a validated idea that you can pursue further. It's a win-win situation ~",
      "I've been making a public-releasable version of diddohub under the wraps, coming soon! ✨",
      "(ps... I'm the one in the red hoodie 👇🏼)",
    ],
    images: [
      { link: "/images/diddohub/dd-1.jpg", alt: "diddohub" },
      { link: "/images/diddohub/dd-2.jpg", alt: "diddohub team - ARTEMIS" },
    ],
    links: [
      {
        type: "website",
        name: "Slide Deck",
        href: "https://drive.google.com/file/d/1r6bT7cl8nPue7QGrfrikaNeD1JlhRLxw/view?usp=share_link",
      },
    ],
  },
  {
    slug: "exoplanet-explore",
    kind: "Data visualisation",
    name: "Exoplanet Explore",
    image: "/images/exoplanet.png",
    description: "Kepler and NASA data as a star map you can explore",
    accentColor: "#de2f53",
    links: [
      {
        type: "website",
        name: "Visit Exoplanet Explore",
        href: "https://exoplanetexplore.vercel.app/",
      },
      {
        type: "github",
        name: "View Source",
        href: "https://github.com/sanvishal/Exoplanet-Explore",
      },
    ],
    about: [
      "Exoplanet Explore is a Data driven Visual Analysis of Exoplanets. The project is made for data analysis hackathon by hackerearth. It won first prize! The project took about 15 days to build. It was an awesome experience.",
      "I was a space geek since birth, I never stopped gazing at the sky and thinking about the stars and planets. It blows my mind if we think how miraculously small and alone we are in this infinitely expanding cosmos. I had the Kepler Telescope findings and NASA's official analytic data at my disposal. I barely had any knowledge about data visualization and analysis using programming. But the raw interest that I had in space exploration drove me through the learning process of programmatic data visualization. I had somewhat past experience in full-stack web development. with all these skills and my enthusiasm, I solely finished this project in a month. It was a wonderful, memorable experience. I loved every second sculpting this project from the scratch",
      "Technically, the project is built with plain old HTML, CSS, JS with D3.js for data viz and python pandas for initial data exploration and cleanup",
    ],
    images: [
      {
        link: "/images/exoplanet/exo-1.gif",
        alt: "A gif showing Exoplanet explore's interactive starmap atlas",
      },
      {
        link: "/images/exoplanet/exo-2.gif",
        alt: "A gif showing Exoplanet explore's correlation matrix",
      },
      {
        link: "/images/exoplanet/exo-3.png",
        alt: "A png showing John F. Kennedy's quote on space exploration",
      },
    ],
  },
  {
    slug: "yata",
    kind: "Project manager",
    name: "Yata",
    image: "/images/yata.png",
    description: "A project manager that sorts work by hashtag",
    accentColor: "#fd554f",
    links: [
      { type: "website", name: "Visit Yata", href: "https://yataapp.vercel.app/" },
      { type: "github", name: "View Source", href: "https://github.com/sanvishal/Yata" },
    ],
    about: [
      '"This app is currently offline"',
      "Yata stands for Yet Another Todo App, but it is more of a project management app. You can create projects and add tasks under it",
      "The best thing about Yata is that it works on hashtags, you can mention, colorcode hashtags on other tasks and they would get automagically interlinked",
      "This project is made for a hackathon in about 10 days",
    ],
    images: [
      { link: "/images/yata/yata-1.png", alt: "A png showing the overview of Yata" },
      { link: "/images/yata/yata-2.png", alt: "A png showing the overview of Yata" },
    ],
  },
  {
    slug: "watchdog",
    kind: "Monitoring dashboard",
    name: "WatchDog",
    image: "/images/watchdog.png",
    description: "A monitoring dashboard for firefighters",
    accentColor: "#FA9E7A",
    links: [
      { type: "website", name: "Visit WatchDog", href: "https://watchdogapp.vercel.app/" },
      { type: "github", name: "View Source", href: "https://github.com/sanvishal/watchdog" },
    ],
    about: [
      '"This app is currently offline"',
      "This is a final year project that my team made for UG college degree",
      "It is a dashboard built to monitor firefighters on their vitals, they would essentially carry a NodeMCU powered mini-transmitter that transmits all the vital data to a firebase realtime database, The react dashboard then shows the data on a pretty graphical format.",
      "It has various alarms for which the dashboard operators would receive alerts on, for example, they would be getting warning and alerts when CO2 or particulate matter gets below a certain threshold",
      "I mostly worked on interfacing the hardware with firebase and building out the frontend app",
    ],
    images: [
      {
        link: "/images/watchdog/watchdog-1.png",
        alt: "A png showing the overview of watchdog app",
      },
    ],
  },
  {
    slug: "old-website",
    kind: "Portfolio, 2018",
    name: "Old Website",
    image: "/images/oldme.png",
    description: "The 2018 me, kept as it was",
    accentColor: "#fd4445",
    links: [
      { type: "website", name: "Visit Old Website", href: "https://tkvishalold.vercel.app/" },
      {
        type: "github",
        name: "View Source",
        href: "https://github.com/sanvishal/new-portfolio",
      },
    ],
    about: ["some people like the old design better lol :P"],
    images: [],
  },
];

export const randomProjects: RandomProject[] = [
  {
    name: "Overgrown",
    description: "An app nobody opens any more, with the moss taking it back.",
    about: "Rust, grime, moss and ivy, grown over a real interface.",
    link: "/lab/overgrown",
  },
  {
    name: "Grass",
    description: "Pixel grass that grows in over bare earth and bends in the wind.",
    about: "Click it to plant flowers.",
    link: "/lab/grass",
  },
  {
    name: "Curse of the Ego King",
    description: "A fast action game about a king with a very big ego.",
    about: "Won “most creative” at the Replit Kaboom game jam, 2021.",
    image: "/images/randoms/ego.png",
    link: "https://replit.com/@vishal1999tk/Curse-of-the-Ego-King?v=1",
  },
  {
    name: "Games on itch.io",
    description: "Every game I made before 2018.",
    about: "Making these is how I learned to program and design, without meaning to.",
    image: "/images/randoms/itch.jpg",
    link: "https://tkgames.itch.io",
  },
  {
    name: "DiddoHub beta",
    description: "A notes editor that stays in sync with a YouTube video.",
    about: "A later version of it won the company hackathon.",
    image: "/images/diddohub.png",
    link: "https://drive.google.com/file/d/1r6bT7cl8nPue7QGrfrikaNeD1JlhRLxw/view",
  },
  {
    name: "Chaos Shapes",
    description: "Animated shapes, chaotic and somehow pretty.",
    about: "Made by accident while learning maths functions.",
    image: "/images/randoms/randomph.png",
    link: "https://replit.com/@vishal1999tk/Random-Shapes-Generator?v=1",
  },
  {
    name: "Generative Scapes",
    description: "Mountain scapes drawn from simple maths.",
    about: "Proof that simple maths can be beautiful.",
    image: "/images/randoms/randomph.png",
    link: "https://replit.com/@vishal1999tk/Generative-Scapes?v=1",
  },
];

export const work: WorkItem[] = [
  {
    company: "PushOwl",
    role: "Frontend Engineer",
    period: "Jul 2023 - Present",
    bullets: [
      "Working on shopify apps, currently neck-deep into the ecosystem",
      "Managing multiple huge frontend codebases serving millions of clients",
    ],
  },
  {
    company: "Presidio",
    role: "Senior Software Engineer",
    period: "Mar 2023 - Jul 2023",
    bullets: [
      "Writing scalable IaC(Infrastructure as Code) in typescript using CDK",
      "Managing complex async dynamic state machines with AWS step functions and building an interactive flow visualizer on the frontend",
    ],
  },
  {
    company: "Presidio",
    role: "Software Engineer",
    period: "Nov 2021 - Mar 2023",
    bullets: [
      "Worked on a data heavy dashboard to process & display bulky near-realtime data.",
      "Maintained an abstract design system built on top of MUI",
      "Optimized and resolved performance issues that improved the whole application's UX, wrote a series of blogs on the discovery.",
      "Developed in-house dev tools and introduced modern React design patterns which greatly improved the developer experience.",
      "Wrote scalable AWS Infrastructure with CDK and built microservices with NestJS",
    ],
  },
  {
    company: "Presidio",
    role: "Associate Software Engineer",
    period: "Aug 2021 - Nov 2021",
    bullets: ["Get AWS Certified - Solutions Architect Associate"],
  },
  {
    company: "Presidio",
    role: "Developer Intern",
    period: "Jul 2020 - Nov 2021",
    bullets: [
      "Worked on a realtime videoconferencing e-commerce webapp utilizing AWS resources, optimized the app on mobile & tablet screens",
      "Dig deep into angular code to fix frontend performance issues of a WebRTC application, which increased the number of concurrent video participants by 60%",
    ],
  },
];
