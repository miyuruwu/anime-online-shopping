const express = require('express');
const app = express();

app.use(express.urlencoded({ extended: true, limit: "5mb" }));

// Other configurations and route handling

module.exports = app;