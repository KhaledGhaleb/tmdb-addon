import 'dotenv/config';
import { MovieDb } from 'moviedb-promise';
import { getGenreList } from './getGenreList.js';
import { parseMedia } from '../utils/parseProps.js';
import * as TL from 'transliteration'; // CJS-safe import pattern
import geminiService from '../utils/gemini-service.js'; // assumes default export

const { transliterate } = TL; // grab the function safely

const movieDb = new MovieDb(process.env.TMDB_API);

function isNonLatin(text) {
  return /[^\u0000-\u007F]/.test(text);
}

// helpers (put near top of file)
const toYear = (dateStr) => (dateStr ? Number(dateStr.slice(0, 4)) : NaN);
const withinYears = (dateStr, numYears) => {
  if (!numYears) return true; // no limit
  const y = toYear(dateStr);
  if (Number.isNaN(y)) return false;
  const now = new Date().getFullYear();
  const cutoff = now - numYears + 1; // inclusive window
  return y >= cutoff;
};

async function getSearch(id, type, language, query, config) {
  // optional knobs (from config or hardcode)
  const MIN_VOTES_MOVIES = config.minVotesMovies ?? 100; // e.g. 50
  const MIN_VOTES_TV = config.minVotesTV ?? 100; // e.g. 50
  const MIN_POP = config.minPopularity ?? 0; // e.g. 0
  const YEARS_WIN = config.numYears ?? 10; // 1..120 or undefined
  const SORT_BY = config.sortBy ?? 'popularity'; // 'popularity' | 'vote_average'
  const SORT_DIR = config.sortDir ?? 'desc'; // 'desc' | 'asc'
  // console.log(
  //   MIN_VOTES_MOVIES,
  //   MIN_VOTES_TV,
  //   MIN_POP,
  //   YEARS_WIN,
  //   SORT_BY,
  //   SORT_DIR
  // );
  // small sorter
  const sorters = {
    popularity: (a, b) =>
      SORT_DIR === 'desc'
        ? b.popularity - a.popularity
        : a.popularity - b.popularity,
    vote_average: (a, b) =>
      SORT_DIR === 'desc'
        ? b.vote_average - a.vote_average
        : a.vote_average - b.vote_average,
  };

  // Apply local filters first (cheap), then optional certification, then sort
  async function filterSortTvItems(movieDb, items) {
    let out = (items ?? [])
      .filter((r) => (config.includeAdult ? true : !r.adult))
      .filter((r) => (r.vote_count ?? 0) >= MIN_VOTES_TV)
      .filter((r) => (r.popularity ?? 0) >= MIN_POP)
      .filter((r) => withinYears(r.first_air_date, YEARS_WIN));

    out.sort(sorters[SORT_BY]);
    return out;
  }

  // Push parsed media while de-duping against what's already in searchResults
  function pushTvParsed(items, searchResults, genreList) {
    const seen = new Set(searchResults.map((m) => m.id));
    for (const el of items) {
      const id = `tmdb:${el.id}`;
      if (seen.has(id)) continue;
      searchResults.push(parseMedia(el, 'tv', genreList));
      seen.add(id);
    }
  }

  let searchQuery = query;
  if (isNonLatin(searchQuery)) {
    searchQuery = transliterate(searchQuery);
  }

  const isAISearch = id === 'tmdb.aisearch';
  let searchResults = [];

  if (isAISearch && config.geminikey) {
    try {
      await geminiService.initialize(config.geminikey);

      const titles = await geminiService.searchWithAI(query, type);

      const genreList = await getGenreList(language, type);

      const searchPromises = titles.map(async (title) => {
        try {
          const parameters = {
            query: title,
            language,
            include_adult: config.includeAdult,
          };

          if (type === 'movie') {
            const res = await movieDb.searchMovie(parameters);
            if (res.results && res.results.length > 0) {
              return parseMedia(res.results[0], 'movie', genreList);
            }
          } else {
            const res = await movieDb.searchTv(parameters);
            if (res.results && res.results.length > 0) {
              return parseMedia(res.results[0], 'tv', genreList);
            }
          }
          return null;
        } catch (error) {
          console.error(
            `Erro ao buscar detalhes para título "${title}":`,
            error
          );
          return null;
        }
      });

      const results = await Promise.all(searchPromises);
      searchResults = results.filter((result) => result !== null);
    } catch (error) {
      console.error('Erro ao processar busca com IA:', error);
    }
  }

  if (searchResults.length === 0) {
    const genreList = await getGenreList(language, type);
    // console.log('genreList', genreList);
    const parameters = {
      query: query,
      language,
      include_adult: config.includeAdult,
    };

    // Return the US certification string (e.g., "PG-13") or null
    async function getUSMovieCert(movieDb, id) {
      try {
        const data = await movieDb.movieReleaseDates({ id });
        const us = data?.results?.find((r) => r.iso_3166_1 === 'US');
        const cert = us?.release_dates
          ?.map((rd) => rd.certification)
          .find(Boolean);
        return cert || null;
      } catch {
        return null;
      }
    }

    // --- US certification checks ---
    async function movieMatchesUSCert(movieDb, id, allowed) {
      try {
        const data = await movieDb.movieReleaseDates({ id });
        const us = data?.results?.find((r) => r.iso_3166_1 === 'US');
        if (!us?.release_dates?.length) return false;
        return us.release_dates.some(
          (rd) => rd.certification && allowed.includes(rd.certification)
        );
      } catch {
        return false;
      }
    }

    async function tvMatchesUSCert(movieDb, id, allowed) {
      try {
        const data = await movieDb.tvContentRatings({ id });
        const us = data?.results?.find((r) => r.iso_3166_1 === 'US');
        return !!(us?.rating && allowed.includes(us.rating));
      } catch {
        return false;
      }
    }

    // --- tiny concurrency limiter (no extra deps) ---
    async function limitConcurrent(items, limit, worker) {
      const results = new Array(items.length);
      let i = 0,
        active = 0;
      return await new Promise((resolve) => {
        const kick = () => {
          while (active < limit && i < items.length) {
            const idx = i++,
              val = items[idx];
            active++;
            Promise.resolve(worker(val, idx))
              .then((r) => {
                results[idx] = r;
              })
              .catch(() => {
                results[idx] = false;
              })
              .finally(() => {
                active--;
                i === items.length && active === 0 ? resolve(results) : kick();
              });
          }
        };
        kick();
      });
    }

    // --- ladders (same idea you used) ---
    const MOVIE_CERTS = {
      G: ['G'],
      PG: ['G', 'PG'],
      'PG-13': ['G', 'PG', 'PG-13'],
      R: ['G', 'PG', 'PG-13', 'R'],
    };
    const TV_CERTS = {
      G: ['TV-G'],
      PG: ['TV-G', 'TV-PG'],
      'PG-13': ['TV-G', 'TV-PG', 'TV-14'],
      R: ['TV-G', 'TV-PG', 'TV-14', 'TV-MA'],
    };

    // Apply US certification with limited concurrency
    async function enforceMovieCertIfNeededOld(
      movieDb,
      items,
      ageRating,
      concurrency = 8
    ) {
      if (!ageRating) return items;
      const allowed = MOVIE_CERTS[ageRating];
      const verdicts = await limitConcurrent(items, concurrency, (el) =>
        movieMatchesUSCert(movieDb, el.id, allowed)
      );
      return items.filter((_, i) => verdicts[i] === true);
    }
    // Apply US certification with limited concurrency and keep a certMap
    async function enforceMovieCertIfNeeded(
      movieDb,
      items,
      ageRating,
      concurrency = 8
    ) {
      if (!ageRating) return { items, certMap: new Map() };
      if (items.length === 0) return { items, certMap: new Map() };

      const allowed = new Set(MOVIE_CERTS[ageRating]);
      const certs = await limitConcurrent(items, concurrency, (el) =>
        getUSMovieCert(movieDb, el.id)
      );

      const certMap = new Map();
      const filtered = [];
      items.forEach((el, i) => {
        const c = certs[i];
        if (c && allowed.has(c)) {
          certMap.set(el.id, c);
          filtered.push(el);
        }
      });
      return { items: filtered, certMap };
    }

    async function enforceTvCertIfNeeded(
      movieDb,
      items,
      ageRating,
      concurrency = 8
    ) {
      if (!ageRating) return items;
      const allowed = TV_CERTS[ageRating];
      const verdicts = await limitConcurrent(items, concurrency, (el) =>
        tvMatchesUSCert(movieDb, el.id, allowed)
      );
      return items.filter((_, i) => verdicts[i] === true);
    }
    console.log(type, parameters);
    if (type === 'movie') {
      try {
        const res = await movieDb.searchMovie(parameters);
        // console.log('res', res);
        const items0 = (res?.results ?? [])
          .filter((r) => (config.includeAdult ? true : !r.adult))
          .filter((r) => (r.vote_count ?? 0) >= MIN_VOTES_MOVIES)
          .filter((r) => (r.popularity ?? 0) >= MIN_POP)
          .filter((r) => withinYears(r.release_date, YEARS_WIN));
        // .sort(sorters[SORT_BY]);
        // console.log('items0', items0);
        const { items: items1, certMap } = await enforceMovieCertIfNeeded(
          movieDb,
          items0,
          config.ageRating,
          8
        );
        // console.log('items1', items1);
        items1.sort(sorters[SORT_BY]); // sorter = sorters[SORT_BY] ?? sorters.popularity
        items1.forEach((el) => {
          const meta = parseMedia(el, 'movie', genreList);

          const year = el.release_date ? el.release_date.slice(0, 4) : '';
          const cert = certMap.get(el.id) || ''; // may be undefined if no age filter was set

          // If parseMedia already puts plain title in meta.name:
          meta.name = `${meta.name}${year ? ` (${year})` : ''}${cert ? ` – ${cert}` : ''}`;

          searchResults.push(meta);
        });
        // console.log('searchResults Movies', searchResults);
      } catch (e) {
        console.error(e);
      }

      await movieDb
        .searchPerson({ query: query, language })
        .then(async (res) => {
          // console.log('person res', res);
          const people = res?.results ?? [];
          if (people.length === 0) return;
          // Prefer exact name match, else highest popularity
          const best = people
            .slice()
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];

          if (!best) return;
          // console.log('best', best);
          const credits = await movieDb.personMovieCredits({
            id: best.id,
            language,
          });
          // Merge cast and selected crew (Director/Writer)
          const crewDW = (credits.crew ?? []).filter(
            (el) => el.job === 'Director' || el.job === 'Writer'
          );
          const merged = [...(credits.cast ?? []), ...crewDW];

          // Base filtering (cheap local checks first)
          let items0 = merged
            .filter((el) => (config.includeAdult ? true : !el.adult))
            .filter((el) => (el.vote_count ?? 0) >= MIN_VOTES_MOVIES)
            .filter((el) => (el.popularity ?? 0) >= MIN_POP)
            .filter((el) => withinYears(el.release_date, YEARS_WIN));
          const { items: items1, certMap } = await enforceMovieCertIfNeeded(
            movieDb,
            items0,
            config.ageRating,
            8
          );

          // Sort (popularity desc/asc)
          items1.sort((a, b) =>
            SORT_DIR === 'desc'
              ? (b.popularity ?? 0) - (a.popularity ?? 0)
              : (a.popularity ?? 0) - (b.popularity ?? 0)
          );

          // De-dupe vs already added metas and within this list
          const seen = new Set(searchResults.map((m) => m.id));
          const local = new Set();

          for (const el of items1) {
            const id = `tmdb:${el.id}`;
            if (seen.has(id) || local.has(id)) continue;
            const meta = parseMedia(el, 'movie', genreList);

            const year = el.release_date ? el.release_date.slice(0, 4) : '';
            const cert = certMap.get(el.id) || ''; // may be undefined if no age filter was set

            // If parseMedia already puts plain title in meta.name:
            meta.name = `${meta.name}${year ? ` (${year})` : ''}${cert ? ` – ${cert}` : ''}`;
            searchResults.push(meta);
            local.add(id);
            if (searchResults.length >= 50) break; // safety cap
          }
          // console.log('searchResults Movies Persons', searchResults);
        })
        .catch(console.error);
    } else if (type === 'series') {
      await movieDb
        .searchTv(parameters)
        .then(async (res) => {
          // console.log('res', res);
          const filtered = await filterSortTvItems(movieDb, res.results);
          pushTvParsed(filtered, searchResults, genreList);
          // console.log('searchResults', searchResults);
        })
        .catch(console.error);

      await movieDb
        .searchPerson({ query, language })
        .then(async (res) => {
          const people = res?.results ?? [];
          if (!people.length) return;

          // pick the most popular match
          const best = people
            .slice()
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))[0];
          if (!best) return;

          const credits = await movieDb.personTvCredits({
            id: best.id,
            language,
          });

          // Keep cast with meaningful participation; include Director/Writer crew
          const castUseful = (credits.cast ?? []).filter(
            (el) => (el.episode_count ?? 0) >= 5
          );
          const crewDW = (credits.crew ?? []).filter(
            (el) => el.job === 'Director' || el.job === 'Writer'
          );

          const merged = [...castUseful, ...crewDW];
          // console.log('merged', merged);

          const filtered = await filterSortTvItems(movieDb, merged);
          pushTvParsed(filtered, searchResults, genreList);

          // console.log('searchResults TV', searchResults);
        })
        .catch(console.error);
    }
  }
  const unique = [];
  const seen = new Set();
  for (const m of searchResults) {
    if (!seen.has(m.id)) {
      seen.add(m.id);
      unique.push(m);
    }
  }
  return Promise.resolve({ query, metas: unique });
}

export { getSearch };
