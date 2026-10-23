import { computeRarity, type CardData, type MediaType } from "./cards";

/**
 * Offline fallback used until TMDB_API_KEY is set.
 * TMDB ids are real; ratings and vote counts are approximate.
 */
type Seed = [id: string, tmdbId: number, title: string, type: MediaType, rating: number, votes: number, year: number, franchise: string | null, overview: string];

const SEEDS: Seed[] = [
  ["movie-11", 11, "Star Wars", "Movie", 8.2, 21000, 1977, "star-wars", "Princess Leia is captured and held hostage by the evil Imperial forces in their effort to take over the galactic Empire."],
  ["movie-157336", 157336, "Interstellar", "Movie", 8.4, 36000, 2014, "nolan", "The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel."],
  ["movie-155", 155, "The Dark Knight", "Movie", 8.5, 33000, 2008, "dark-knight", "Batman raises the stakes in his war on crime, until a criminal mastermind known as the Joker plunges Gotham into anarchy."],
  ["movie-129", 129, "Spirited Away", "Anime", 8.5, 16500, 2001, "ghibli", "A young girl, Chihiro, becomes trapped in a strange new world of spirits and must find a way to free herself and her parents."],
  ["movie-120", 120, "The Fellowship of the Ring", "Movie", 8.4, 25000, 2001, "lord-of-the-rings", "A young hobbit inherits a powerful ring and sets out on a journey to destroy it before the Dark Lord can claim it."],
  ["movie-671", 671, "Harry Potter and the Philosopher's Stone", "Movie", 7.9, 27000, 2001, "harry-potter", "On his eleventh birthday, Harry learns he is the son of two powerful wizards and is invited to Hogwarts."],
  ["tv-1396", 1396, "Breaking Bad", "TV Series", 8.9, 14000, 2008, null, "A chemistry teacher diagnosed with terminal cancer turns to manufacturing methamphetamine to secure his family's future."],
  ["tv-1429", 1429, "Attack on Titan", "Anime", 8.7, 7000, 2013, null, "Humanity lives behind enormous walls to protect itself from the Titans, gigantic humanoids that devour humans."],
  ["movie-330459", 330459, "Rogue One: A Star Wars Story", "Movie", 7.5, 15000, 2016, "star-wars", "A band of rebels comes together to steal the plans for the Empire's ultimate weapon, the Death Star."],
  ["tv-94605", 94605, "Arcane", "TV Series", 8.7, 4500, 2021, null, "Amid the stark discord of twin cities Piltover and Zaun, two sisters fight on rival sides of a war."],
  ["movie-348350", 348350, "Solo: A Star Wars Story", "Movie", 6.6, 8000, 2018, "star-wars", "Through a series of daring escapades, Han Solo meets his future co-pilot Chewbacca and encounters Lando Calrissian."],
  ["tv-60625", 60625, "Rick and Morty", "TV Series", 8.7, 1600, 2013, null, "Rick is a mad scientist who drags his grandson Morty along on dangerous outer-space adventures."],
];

export const SAMPLE_CARDS: CardData[] = SEEDS.map(
  ([id, tmdbId, title, type, rating, voteCount, releaseDate, franchise, overview]) => ({
    id,
    tmdbId,
    title,
    poster: null,
    backdrop: null,
    type,
    rating,
    voteCount,
    popularity: 0,
    releaseDate,
    overview,
    franchise,
    rarity: computeRarity(type, voteCount, rating),
  }),
);
