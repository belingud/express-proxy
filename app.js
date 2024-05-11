let express = require("express");
let morgan = require("morgan");
const {
    createProxyMiddleware,
    debugProxyErrorsPlugin, // subscribe to proxy errors to prevent server from crashing
    errorResponsePlugin, // return 5xx response on proxy error
    proxyEventsPlugin, // implements the "on:" option
    loggerPlugin,
} = require("http-proxy-middleware");

let STATUS_CODES = require("./statuscode");

// disable certificate verification
process.env.NODE_TLS_REJECT_UNAUTHORIZED = false;

const winston = require("winston");
const logger = winston.createLogger({
    transports: [new winston.transports.Console()],
    format: winston.format.combine(winston.format.timestamp()),
});
logger.info(`Runing environment: ${process.env.NODE_ENV}`);
const NO_BODY_METHODS = ["GET", "HEAD"];
const TARGET_PARAM_NAME = "target";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// 允许跨域
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
    );
    res.header("Access-Control-Allow-Headers", "*");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
        res.sendStatus(200);
    } else {
        next();
    }
});

app.options("*", (req, res) => {
    res.sendStatus(HTTP_STATUS.OK);
});

app.get("/hello", (req, res) => {
    logger.info("In HELLO: ", req.url);
    res.send("Hello World!");
});

// 解析请求参数为URL对象
function parseUrlParam(req) {
    const proxyUrlWithQuery = req.query[TARGET_PARAM_NAME]; // 从query string获取url参数
    // 尝试解析URL及其查询参数
    try {
        const url = new URL(proxyUrlWithQuery);
        // 这里可以添加额外的验证逻辑，例如检查协议或主机等
        return url;
    } catch (err) {
        console.error("Invalid URL parameter:", err);
        return null;
    }
}

app.all("/", (req, res) => {
    const proxyUrl = parseUrlParam(req);
    req.url = proxyUrl.pathname + proxyUrl.search;
    console.log("new req.url is: ", req.url);

    // 如果URL参数无效，返回错误响应
    if (!proxyUrl) {
        return res.status(STATUS_CODES.BAD_REQUEST).send("ILLEGAL PARAMS");
    }
    // 协议校验
    if (proxyUrl.protocol !== "http:" && proxyUrl.protocol !== "https:") {
        return res
            .status(STATUS_CODES.BAD_REQUEST)
            .send("Only HTTP and HTTPS protocols are allowed");
    }

    // 动态创建代理中间件
    const proxy = createProxyMiddleware({
        // logger: console,
        target: proxyUrl.origin, // 使用带protocal的地址
        changeOrigin: true,
        plugins: [
            debugProxyErrorsPlugin,
            loggerPlugin,
            errorResponsePlugin,
            proxyEventsPlugin,
        ],
    });

    // 使用代理中间件
    proxy(req, res);
});

app.all("/proxy", async (request, response, next) => {
    // 从请求的查询参数中获取目标视频URL
    const url = request.query.url;
    if (!url) {
        return response.status(STATUS_CODES.BAD_REQUEST).send("NOT IN SERVICE");
    }
    console.log(request.url);
    console.log(request.headers);
    let targetUrl;
    try {
        targetUrl = new URL(url);
    } catch (error) {
        console.error(error);
        return response.status(STATUS_CODES.BAD_REQUEST).send("ILLEGAL PARAMS");
    }

    console.log("start to proxy to target url: ", targetUrl);
    // 发起请求到目标视频服务器
    let requestInit = {
        method: request.method,
        headers: request.headers, // 将请求头原样传递给视频服务器
    };
    if (!NO_BODY_METHODS.includes(request.method)) {
        requestInit.body = request.body;
    }
    let proxyRes;
    try {
        proxyRes = await fetch(targetUrl, requestInit);
    } catch (error) {
        return next(error);
    }
    console.log("response status: ", proxyRes.status);
    console.log(proxyRes.headers.get("location"));
    console.log(proxyRes.headers.get("Content-Type"));
    return response
        .status(proxyRes.status)
        .setHeaders(proxyRes.headers)
        .send(proxyRes.body);
});

// app.listen(3000, () => {
//   console.log("Proxy server is running on port 3000");
// });

// 异常中间件
app.use((err, req, res, next) => {
    // 记录错误
    console.error(err.stack);
    // 错误响应
    res.status(STATUS_CODES.INTERNAL_SERVER_ERROR).json({ error: err.message });
});

module.exports = app;

if (process.env.NODE_ENV === "development") {
    app.listen(process.env.PORT || 3000, async () => {
        console.log("Server started on port " + (process.env.PORT || 3000));
    });
}
