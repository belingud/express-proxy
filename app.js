import express from "express";
import morgan from "morgan";
import axios from "axios";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.options("*", (req, res) => {
  res.sendStatus(200);
});

app.all("/proxy", async (req, res) => {
  const url = req.query.url;

  try {
    let response;

    if (req.method === "GET") {
      response = await axios.get(url, { headers: req.headers });
    } else if (req.method === "POST") {
      response = await axios.post(url, req.body, { headers: req.headers });
    } else if (req.method === "PUT") {
      response = await axios.put(url, req.body, { headers: req.headers });
    } else if (req.method === "DELETE") {
      response = await axios.delete(url, { headers: req.headers });
    }

    res.send(response.data);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// app.listen(3000, () => {
//   console.log("Proxy server is running on port 3000");
// });

module.exports = app;

const main = async () => {
  app.listen(process.env.PORT || 3000, async () => {
    console.log("Server started on port " + (process.env.PORT || 3000));
  });
};

// main();
