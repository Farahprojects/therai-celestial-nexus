
import { useState, useEffect } from 'react';

const astrologyFacts = [
  "The word 'zodiac' comes from the Greek word 'zodiakos', meaning 'circle of animals'.",
  "Astrology has been practiced for over 4,000 years across many cultures.",
  "The Sun sign represents your core personality and ego.",
  "Your Moon sign reveals your emotional nature and inner self.",
  "Mercury retrograde happens 3-4 times per year and lasts about 3 weeks.",
  "The houses in astrology represent different areas of life experience.",
  "Venus rules both Taurus and Libra, governing love and beauty.",
  "Mars is the planet of action, energy, and desire.",
  "Jupiter is known as the planet of luck and expansion.",
  "Saturn teaches us discipline and life lessons through challenges.",
  "Your rising sign is how others perceive you at first meeting.",
  "The elements in astrology are Fire, Earth, Air, and Water.",
  "Cardinal signs initiate, Fixed signs sustain, Mutable signs adapt.",
  "A birth chart is a snapshot of the sky at your exact moment of birth.",
  "Astrology can help you understand your natural talents and challenges."
];

export const useAstrologyFacts = () => {
  const [currentFact, setCurrentFact] = useState('');

  useEffect(() => {
    const getRandomFact = () => {
      const randomIndex = Math.floor(Math.random() * astrologyFacts.length);
      return astrologyFacts[randomIndex];
    };

    setCurrentFact(getRandomFact());
  }, []);

  return currentFact;
};
