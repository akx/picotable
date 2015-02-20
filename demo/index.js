var fs = require("fs");
var express = require("express");
var _ = require("lodash");
var app = express();
app.use(express.static(__dirname + "/.."));

var items = _.map(_.range(42, 1337), function(i) {
    return {
        id: i,
        name: "Thing " + i,
        age: 0 | (10 + (i * 1.63) % 10),
        color: ["Red", "Green", "Blue"][(0 | (i * 1.2343)) % 3]
    };
});

app.get("/", function(req, res) {
    res.send(fs.readFileSync(__dirname + "/demo.html", "UTF-8"));
});

app.get("/data", function(req, res) {
    var query = JSON.parse(req.query.jq);
    var perPage = 0 | query.perPage;
    var pageNum = 0 | query.page;
    var start = (pageNum - 1) * perPage;
    var end = (pageNum) * perPage - 1;
    var data = {
        "columns": [
            {"id": "name", "title": "Name"},
            {"id": "color", "title": "Color"},
            {"id": "age", "title": "Age", "className": "text-right"}
        ],
        "pagination": {
            "nItems": items.length,
            "nPages": Math.ceil(items.length / perPage),
            "perPage": perPage,
            "pageNum": pageNum
        },
        "items": _.slice(items, start, end)
    };
    res.send(data);
});

var server = app.listen(30000, function() {
    var host = server.address().address;
    var port = server.address().port;
    console.log("Listening at http://%s:%s", host, port);
});
