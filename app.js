let express = require("express");
let morgan = require("morgan");
let axios = require("axios");
const https = require("https");
// disable certificate verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = false;

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
  console.log("param url is: ", url);

  try {
    let response;
    const instance = axios.create({
      httpsAgent: new https.Agent({
        rejectUnauthorized: false,
      }),
    });

    if (req.method === "GET") {
      response = await instance.get(url, { headers: req.headers });
    } else if (req.method === "POST") {
      response = await instance.post(url, req.body, { headers: req.headers });
    } else if (req.method === "PUT") {
      response = await instance.put(url, req.body, { headers: req.headers });
    } else if (req.method === "DELETE") {
      response = await instance.delete(url, { headers: req.headers });
    }

    res.send(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).send(error.stack);
  }
});

// app.listen(3000, () => {
//   console.log("Proxy server is running on port 3000");
// });

module.exports = app;

if (process.env.NODE_ENV === "development") {
  app.listen(process.env.PORT || 3000, async () => {
    console.log("Server started on port " + (process.env.PORT || 3000));
  });
}
