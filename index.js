import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";

const app = express();
const port = 3000;
const API_URL = "http://www.omdbapi.com/";
const yourAPIKey = "75d3503a";

// const db = new pg.Client({
//   user: "postgres",
//   host: "localhost",
//   database: "movies project",
//   password: "MyDB",
//   port: 5432,
// });

const db = new pg.Client({
  user: "movies_uq5t_user",
  host: "dpg-cqsbes0gph6c73a96bug-a",
  database: "movies_uq5t",
  password: "zRav3FUUAJ6jRJUsZ7yBB7uHXcrujd8J",
  port: 5432,
});
// const { Pool } = pg;

// const db = new Pool({
//   connectionString: "postgres://postgres:MyDB@localhost:5432/movies project",
// });

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
    const apiResult = await axios.get(API_URL, {
      params: {
        apikey: yourAPIKey,
        t: movieName
      },
    });
    const movie = apiResult.data;
    const result = await db.query("SELECT * FROM movies WHERE imdbID = $1", [movie.imdbID]);
    if (result.rows.length > 0) {
      res.render("movie-details.ejs", { movie: result.rows[0] });
    }
    else {
      res.render("add-movie.ejs", {
        data: {
          Title: movie.Title,
          Year: movie.Year,
          Genre: movie.Genre,
          Writer: movie.Writer,
          Plot: movie.Plot,
          Poster: movie.Poster,
          imdbID: movie.imdbID
        }
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
    await db.query(
      "INSERT INTO movies (title, year, genre, writer, plot, poster, rating, imdbID) " +
      "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
      [
        movie.title,
        movie.year,
        movie.genre,
        movie.writer,
        movie.plot,
        movie.poster,
        movie.rating,
        movie.imdbID
      ]
    );
    res.render("movie-details.ejs", { movie: movie });
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
