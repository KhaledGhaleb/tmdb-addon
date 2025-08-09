import { MovieDb } from 'moviedb-promise';
import 'dotenv/config'; // same as require("dotenv").config();
const moviedb = new MovieDb(process.env.TMDB_API);

async function getGenreList(language, type) {
  if (type === 'movie') {
    const genre = await moviedb
      .genreMovieList({ language })
      .then((res) => {
        return res.genres;
      })
      .catch(console.error);
    return genre;
  } else {
    const genre = await moviedb
      .genreTvList({ language })
      .then((res) => {
        return res.genres;
      })
      .catch(console.error);
    return genre;
  }
}

export { getGenreList };
