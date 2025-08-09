import axios from "axios";
import "dotenv/config"; // same as require("dotenv").config();

async function getRequestToken() {
  return axios
    .get(
      `https://api.themoviedb.org/3/authentication/token/new?api_key=${process.env.TMDB_API}`,
    )
    .then((response) => {
      if (response.data.success) {
        return response.data.request_token;
      }
    });
}

async function getSessionId(requestToken) {
  return axios
    .get(
      `https://api.themoviedb.org/3/authentication/session/new?api_key=${process.env.TMDB_API}&request_token=${requestToken}`,
    )
    .then((response) => {
      if (response.data.success) {
        return response.data.session_id;
      }
    });
}

export { getRequestToken, getSessionId };
