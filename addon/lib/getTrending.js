import 'dotenv/config';
import { getMeta } from './getMeta.js';
import { MovieDb } from 'moviedb-promise';

const moviedb = new MovieDb(process.env.TMDB_API);

async function getTrending(type, language, page, genre, config) {
  const media_type = type === 'series' ? 'tv' : type;
  const parameters = {
    media_type,
    time_window: genre ? genre.toLowerCase() : 'day',
    language,
    page,
  };

  return await moviedb
    .trending(parameters)
    .then(async (res) => {
      const metaPromises = res.results.map((item) =>
        getMeta(type, language, item.id, config.rpdbkey)
          .then((result) => result.meta)
          .catch((err) => {
            console.error(
              `Erro ao buscar metadados para ${item.id}:`,
              err.message
            );
            return null;
          })
      );

      const metas = (await Promise.all(metaPromises)).filter(Boolean);
      return { metas };
    })
    .catch(console.error);
}
export { getTrending };
