import { Spacer, Box, Center, Text } from '@chakra-ui/react';
import { ChakraNextImage } from '../components/ChakraNextImage';
import { FancyLink } from '../components/FancyLink';
import { Socials } from '../components/Socials/Socials';
import { Waves } from '../components/Waves';

export const HomePage = () => {
  return (
    <>
      <Socials />
      <ChakraNextImage
        src="/images/tk.png"
        width={100}
        height={100}
        quality={100}
        layout="responsive"
        showBlur={false}
      />
      <Spacer w="full" h={10} />
      <Text fontWeight="black" fontSize="2xl">
        Vishal <span className="gradiant-text">TK</span>
      </Text>
      <Text fontSize="lg" mt={2}>
        Software Engineer @ <FancyLink href="https://www.presidio.com/">Presidio</FancyLink>, in
        love with crafting magical experiences with design, code and art
      </Text>
      <Box mt={8}>
        <Waves fill="grey" opacity="0.27" />
      </Box>
      <Spacer w="full" h={8} />
      <Text fontWeight="700" lineHeight="1.8">
        Building beautiful and performant applications with rich UI/UX design, highly devoted to the
        tiniest details, polish and craft in my work from backend to frontend till people ends ~
      </Text>
      <Spacer w="full" h={14} />
      <Center>🌻</Center>
    </>
  );
};