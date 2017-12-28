const express = require('express');

const {Chromeless} = require('chromeless');
const fs = require('fs');
const compression = require('compression');
const path = require('path');
const url = require('url');
const now = require('performance-now');
const chromeLauncher = require('chrome-launcher');

const CONFIG_PATH = path.resolve(__dirname, '../config.json');


const app = express();
const PORT = process.env.PORT || '3000';


let config = {};

// Load config from config.json if it exists.
if (fs.existsSync(CONFIG_PATH)) {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH));
    assert(config instanceof Object);
}


// Allows the config to be overriden
app.setConfig = (newConfig) => {
    const oldConfig = config;
    config = newConfig;
    config.chrome = oldConfig.chrome;
    config.port = oldConfig.port;
};

app.use(compression());

async function render(url, scroll, wait) {
    const chromeless = new Chromeless({launchChrome: false, cdp: {port: config.port, host: config.host}});
    const html = await chromeless.goto(url)
        .scrollTo(0, scroll)
        .wait(wait)
        .html();
    await  chromeless.end();
    return html;
}

async function screenshot(url, scroll, wait) {
    const chromeless = new Chromeless({launchChrome: false, cdp: {port: config.port, host: config.host}});
    const shot = await chromeless.goto(url)
        .scrollTo(0, scroll)
        .wait(wait)
        .screenshot();
    await  chromeless.end();
    return fs.readFileSync(shot);
}

function isRestricted(urlReq) {
    const protocol = (url.parse(urlReq).protocol || '');

    if (!protocol.match(/^https?/)) return true;
    if (!config['renderOnly']) return false;

    for (let i = 0; i < config['renderOnly'].length; i++) {
        if (urlReq.startsWith(config['renderOnly'][i])) {
            return false;
        }
    }

    return true;
}

if (!!config['debug']) {
    console.log(`Rendertron configured with ${JSON.stringify(config, null, 2)}`);
    app.get('/render/:url(*)', (req, res, next) => {
        console.log('Render requested for ' + req.params.url);
    });
    app.get('/screenshot/:url(*)', (req, res, next) => {
        console.log('Screenshot requested for ' + req.params.url);
    });
}
app.get('/render/:url(*)', async (request, response) => {
    if (isRestricted(request.params.url)) {
        response.status(403).send('Render request forbidden, domain excluded');
        return;
    }
    const scroll = parseInt(request.query.scroll || "0");
    const wait = parseInt(request.query.wait || "0");
    const start = now();
    const html = await render(request.params.url, scroll, wait);
    response.set('UseTime', now() - start);
    response.status(200).end(html);
});

app.get('/params/:url(*)', async (request, response) => {
    response.status(200).end(JSON.stringify({url: request.params.url, query: request.query}));
});

app.get('/_ah/health', (request, response) => response.send('OK'));

app.stop = async () => {
    await config.chrome.kill();
};

app.get('/screenshot/:url(*)', async (request, response) => {
    if (isRestricted(request.params.url)) {
        response.status(403).send('Render request forbidden, domain excluded');
        return;
    }
    const scroll = parseInt(request.query.scroll || "0");
    const wait = parseInt(request.query.wait || "0");
    const start = now();
    const shot = await screenshot(request.params.url, scroll, wait);
    // const img = new Buffer(shot, 'base64');
    response.set({
        'Content-Type': 'image/png',
        'Content-Length': shot.length,
        'UseTime': now() - start
    });
    response.status(200).end(shot);
});


const appPromise = chromeLauncher.launch({
    chromeFlags: ['--headless', '--disable-gpu', '--remote-debugging-address=0.0.0.0'],
    port: 0
}).then((chrome) => {
    console.log('Chrome launched with debugging on port', chrome.port);
    config.chrome = chrome;
    config.port = chrome.port;
    config.host = 'localhost';
    // Don't open a port when running from inside a module (eg. tests). Importing
    // module can control this.
    if (!module.parent) {
        app.listen(PORT, function () {
            console.log('Listening on port', PORT);
        });
    }
    return app;
}).catch((error) => {
    console.error(error);
    // Critical failure, exit with error code.
    process.exit(1);
});

let exceptionCount = 0;

async function logUncaughtError(error) {
    console.error('Uncaught exception');
    console.error(error);
    exceptionCount++;
    // Restart instance due to several failures.
    if (exceptionCount > 5) {
        console.log(`Detected ${exceptionCount} errors, shutting instance down`);
        if (config && config.chrome)
            await app.stop();
        process.exit(1);
    }
}

if (!module.parent) {
    process.on('uncaughtException', logUncaughtError);
    process.on('unhandledRejection', logUncaughtError);
}
module.exports = appPromise;