import { LinkType, Project } from './types';

export const projects: Project[] = [
  {
    name: 'TeenyTools',
    image: '/images/teenytools.png',
    description: 'All in one tool for designers & developers',
    accentColor: '#E27055',
    about: [
      'A quick, all-in-one toolbox of small tools for designers and designers who code. teenytools has many frequently used tools by developers every day, it provides both the ease of access on commonly used tools and a depth of customizations on those tools too.',
      `I use small websites like coolors, blobmaker, and other small tools literally every single day to do repetitive tasks like making color palettes, creating graphics, and other design-related tasks. I even have them bookmarked for easier access. BUT still, I don't like switching tabs among 20 other tabs that I have open already. on the other hand, I LOVE the UX of Raycast, which allows me to navigate anywhere or execute a small script with just simple commands.`,
      "I wanted an app that does all this in a single tab, that is fast and easy to access, that's how teenytools was born",
      'teenytools is built with CRA, ChakraUI, Framer motion and a ton of research on colors and color spaces',
    ],
    images: [
      { link: '/images/teenytools/tt-1.gif', alt: 'A gif of teenytools functionalities' },
      {
        link: '/images/teenytools/tt-3.png',
        alt: 'An image showing teenytools powerful color editor or explorer',
      },
      { link: '/images/teenytools/tt-2.gif', alt: 'A gif showing teenytools command palette' },
      {
        link: '/images/teenytools/tt-4.gif',
        alt: 'A gif showing teenytools quick actions from command palette',
      },
      {
        link: '/images/teenytools/tt-5.png',
        alt: 'An image showing teenytools generative functionality to generate organic patterns',
      },
    ],
    links: [
      {
        type: LinkType.WEBSITE,
        name: 'Visit TeenyTools',
        href: 'https://teenytools.netlify.app/',
      },
      {
        type: LinkType.GITHUB,
        name: 'View Source',
        href: 'https://github.com/sanvishal/teenytools',
      },
      {
        type: LinkType.BLOG,
        name: 'Read About it',
        href: 'https://vishaltk.hashnode.dev/teenytools-a-quick-all-in-one-toolbox-of-small-tools-for-designers-and-designers-who-code',
      },
    ],
  },
  {
    name: 'Exoplanet Explore',
    image: '/images/exoplanet.png',
    description: 'Interactive Data Visualization of Exoplanets',
    accentColor: '#333333',
    links: [
      {
        type: LinkType.WEBSITE,
        name: 'Visit Exoplanet Explore',
        href: 'https://exoplanetexplore.vercel.app/',
      },
      {
        type: LinkType.GITHUB,
        name: 'View Source',
        href: 'https://github.com/sanvishal/Exoplanet-Explore',
      },
    ],
    about: [
      'Exoplanet Explore is a Data driven Visual Analysis of Exoplanets. The project is made for data analysis hackathon by hackerearth. It won first prize! The project took about 15 days to build. It was an awesome experience.',
      "I was a space geek since birth, I never stopped gazing at the sky and thinking about the stars and planets. It blows my mind if we think how miraculously small and alone we are in this infinitely expanding cosmos. I had the Kepler Telescope findings and NASA's official analytic data at my disposal. I barely had any knowledge about data visualization and analysis using programming. But the raw interest that I had in space exploration drove me through the learning process of programmatic data visualization. I had somewhat past experience in full-stack web development. with all these skills and my enthusiasm, I solely finished this project in a month. It was a wonderful, memorable experience. I loved every second sculpting this project from the scratch",
      'Technically, the project is build with plain old HTML, CSS, JS with D3.js for data viz and python pandas for intital data exploration and cleanup',
    ],
    images: [
      {
        link: '/images/exoplanet/exo-1.gif',
        alt: "A gif showing Exoplanet explore's interactive starmap atlas",
      },
      {
        link: '/images/exoplanet/exo-2.gif',
        alt: "A gif showing Exoplanet explore's correlation matrix",
      },
      {
        link: '/images/exoplanet/exo-3.png',
        alt: "A png showing John F. Kennedy's quote on space exploration",
      },
    ],
  },
  {
    name: 'Yata',
    image: '/images/yata.png',
    description: 'Project Management App based on Hashtags',
    accentColor: '#fd554f',
    links: [
      {
        type: LinkType.WEBSITE,
        name: 'Visit Yata',
        href: 'https://yataapp.vercel.app/',
      },
      {
        type: LinkType.GITHUB,
        name: 'View Source',
        href: 'https://github.com/sanvishal/Yata',
      },
    ],
    about: [
      '"This app is currently offline"',
      'Yata stands for Yet Another Todo App, but it is more of a project management app. You can create projects and add tasks under it',
      'The best thing about Yata is that it works on hashtags, you can mention, colorcode hashtags on other tasks and they would get automagically interlinked',
      'This project is made for a hackathon in about 10 days',
    ],
    images: [
      {
        link: '/images/yata/yata-1.png',
        alt: 'A png showing the overview of Yata',
      },
      {
        link: '/images/yata/yata-2.png',
        alt: 'A png showing the overview of Yata',
      },
    ],
  },
  {
    name: 'WatchDog',
    image: '/images/watchdog.png',
    description: 'Firefigher monitoring dashboard',
    accentColor: '#FA9E7A',
    links: [
      {
        type: LinkType.WEBSITE,
        name: 'Visit WatchDog',
        href: 'https://watchdogapp.vercel.app/',
      },
      {
        type: LinkType.GITHUB,
        name: 'View Source',
        href: 'https://github.com/sanvishal/watchdog',
      },
    ],
    about: [
      '"This app is currently offline"',
      'This is a final year project that my team made for UG college degree',
      'It is a dashboard built to monitor firefighers on their vitals, they would essntially carry a NodeMCU powered mini-transmitter that transmits all the vital data to a firebase realtime database, The react dashboard then shows the data on a pretty graphical format.',
      'It has various alarms for which the dashboard operators would recieve alerts on, for example, they would be getting warning and alerts when CO2 or particulate matter gets below a certain threshold',
      'I mostly worked on interfacing the hardware with firebase and building out the frontend app',
    ],
    images: [
      {
        link: '/images/watchdog/watchdog-1.png',
        alt: 'A png showing the overview of watchdog app',
      },
    ],
  },
  {
    name: '...and many more',
    image: '/images/github.png',
    description: 'more experiments ????',
    accentColor: '#333333',
    links: [
      {
        type: LinkType.GITHUB,
        name: 'View My GitHub',
        href: 'https://github.com/sanvishal',
      },
    ],
  },
];

export const links = {
  [LinkType.WHATSAPP]: 'https://api.whatsapp.com/send?phone=918248795811',
  [LinkType.GITHUB]: 'https://github.com/sanvishal',
  [LinkType.DRIBBBLE]: 'https://dribbble.com/tkvishal',
  [LinkType.LINKEDIN]: 'https://www.linkedin.com/in/tkvishal/',
  [LinkType.TWITTER]: 'https://twitter.com/tk_vishal_tk',
};
