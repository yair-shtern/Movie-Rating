import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import env from "dotenv";


const app = express();
const port = 3000;
const API_URL = "http://www.omdbapi.com/";
const yourAPIKey = process.env.API_KEY;
env.config();

const db = new pg.Client({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: process.env.PG_PORT,
});

db.connect();


app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let movies = [];
var sortBy = "rating";

app.get("/", async (req, res) => {
  try {
    const result = await db.query(`SELECT * FROM movies ORDER BY ${sortBy} DESC`);
    movies = result.rows;

    res.render("index.ejs", {
      movies: movies,
      sortBy: sortBy
    });
  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: [],
      error: 'An error occurred while fetching the movies. Please try again later.'
    });
  }
});

app.get("/movie/:id", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM movies WHERE id = $1", [req.params.id]);
    res.render("movie-details.ejs", { movie: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: [],
      error: 'Error retrieving movie details. Please try again later.'
    });
  }
});

app.post('/sort', async (req, res) => {
  sortBy = req.body.sortBy;
  res.redirect(`/`);
});

app.post("/rate", async (req, res) => {
  const movieName = req.body.movieName;

  try {
    // Step 1: Search for movies based on the movieName
    const apiResult = await axios.get(API_URL, {
      params: {
        apikey: yourAPIKey,
        s: movieName
      },
    });

    const searchData = apiResult.data;
    const movies = searchData.Search; // Array of movies returned

    if (movies && movies.length > 0) {
      // Render search results for user to select a movie
      res.render("movie-list.ejs", { movies: movies });
    } else {
      // Handle case where no movies were found
      res.render("index.ejs", {
        movies: [],
        error: 'No movies found. Please try again with a different search term.'
      });
    }

  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: [],
      error: 'Error fetching data from the API. Please try again later.'
    });
  }
});

// Assume you have a route to handle movie selection from the list
app.get("/select/:imdbID", async (req, res) => {
  const imdbID = req.params.imdbID;

  try {
    // Step 2: Fetch detailed information for the selected movie using imdbID
    const apiResult = await axios.get(API_URL, {
      params: {
        apikey: yourAPIKey,
        i: imdbID // Use 'i' parameter to get movie details by IMDb ID
      },
    });

    const movieDetails = apiResult.data;

    // Check if the movie already exists in your database
    const dbResult = await db.query("SELECT * FROM movies WHERE imdbID = $1", [imdbID]);

    if (dbResult.rows.length > 0) {
      // Movie exists in database, render details
      res.render("movie-details.ejs", { movie: dbResult.rows[0] });
    } else {
      // Movie doesn't exist in database, render add-movie form
      res.render("add-movie.ejs", {
        data: {
          Title: movieDetails.Title,
          Year: movieDetails.Year,
          Genre: movieDetails.Genre,
          Writer: movieDetails.Writer,
          Plot: movieDetails.Plot,
          Poster: movieDetails.Poster,
          imdbID: movieDetails.imdbID
        }
      });
    }

  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: [],
      error: 'Error fetching movie details from the API. Please try again later.'
    });
  }
});

app.get("/search", async (req, res) => {
  const query = req.query.query;
  try {
    const result = await db.query(`SELECT * FROM movies WHERE LOWER(title) LIKE LOWER($1) ORDER BY  ${sortBy} DESC`, [`%${query}%`]);
    if (result.rows.length === 0) {
      res.render("index.ejs", {
        movies: [],
        error: 'No movies found matching your search criteria. try something else.'
      });
    } else {
      res.render("index.ejs", {
        movies: result.rows,
        sortBy: sortBy
      });
    }
  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: [],
      error: 'An error occurred while searching for movies. Please try again later.'
    });
  }
});

app.post("/add", async (req, res) => {
  const movie = req.body.newMovie;
  try {
    const result = await db.query(`
      INSERT INTO movies (title, year, genre, writer, plot, poster, rating, imdbID)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *;`,
      [
        movie.title,
        movie.year,
        movie.genre,
        movie.writer,
        movie.plot,
        movie.poster,
        movie.rating,
        movie.imdbID
      ]);

    res.render("movie-details.ejs", { movie: result.rows[0] });

  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: movies,
      error: "An error occurred while adding the movie. Please try again later."
    });
  }
});


app.post("/edit", async (req, res) => {
  const movieId = req.body.id;
  const newRating = req.body.newRating;
  try {
    const result = await db.query("UPDATE movies SET rating = $1 WHERE id = $2  RETURNING *", [newRating, movieId]);
    res.render("movie-details.ejs", { movie: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: movies,
      error: 'An error occurred while updating the movie rating. Please try again later.'
    });
  }
});

app.post("/delete", async (req, res) => {
  const movieId = req.body.id;
  try {
    await db.query("DELETE FROM movies WHERE id = $1", [movieId]);
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.render("index.ejs", {
      movies: movies,
      error: 'An error occurred while deleting the movie. Please try again later.'
    });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
