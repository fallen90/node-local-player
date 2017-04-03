#!/usr/bin/env node

let __currentdirr = process.cwd();
let express = require('express');
let nsort = require('node-natural-sort');
let path = require('path');
let argv = require('minimist')(process.argv.slice(2));
let app = express();
let PORT = argv.p || argv.port || 80;
let HOST = argv.h || argv.host || argv.ip || '0.0.0.0';
let CONTROLS = argv.controls || argv.c || false;
let fs = require('fs');
let _ = require('underscore');
let request = require('request');
let playlist = [];
let add_this = argv.add || false;
let add_this_host = argv.remote || false;
let url = require('url');


function init(req) {
    let deferred = Promise.defer();
    fs.readdir(__currentdirr, function(err, items) {
        let hostname = req.protocol + '://' + req.get('host') + '/';
        deferred.resolve(items
            .filter(item => {
                return path.extname(item).toLowerCase() === '.mp4';
            })
            .map(item => {
                return hostname + encodeURIComponent(item);
            })
            .sort(nsort()));

        if (err) {
            deferred.reject(err);
        }
    });
    return deferred.promise;
}

app.use(express.static(__currentdirr));

if (add_this && add_this_host != false) {
    let urlObject = url.parse(add_this_host);
    urlObject.get = function(key) {
        return this[key];
    }
    init({
    	protocol : urlObject.protocol.replace(':', ''),
    	get : function(key){
    		if(key == 'host'){
    			return urlObject.hostname + ':' + PORT;
    		}
    	}
    }).then(function(ls) {
        request(add_this_host + '/playlist/?json=' + JSON.stringify(ls), (error, response, body) => {
        	console.log('Player response', response.body);
        });
    }, function(err){
    	console.log('Error', err);
    });
} else {
    app.get('/playlist', (req, res) => {
        var json = req.query.json;
        let data = JSON.parse(json);
        let playlist_before = playlist;

        _.each(data, item => {
            playlist.push(item);
        });
        return res.json({
            status: 'OK',
            added: data.length
        });
    });
    app.use('/scripts', express.static(__dirname + '/node_modules/video.js/dist/'));
    app.get('/', (req, res) => {
        init(req);
        res.redirect('/viewer');
    });
    app.get('/viewer', (req, res) => {

        if (!playlist.length) {
            init(req);
        }

        let options = {
            "controls": CONTROLS,
            "autoplay": true,
            "preload": "auto",
            "aspectRatio": "16:3"
        };
        let html = `
			<head>
			  <link href="scripts/video-js.css" rel="stylesheet">

			  <style>
				body {
					padding:0;
					margin:0;
					background:black;
				}
				video {
					width: 100%;
					height:100%;
				}
				#my-video {
					width:100vw;
					height:100vh;
				}
			  </style>
			</head>

			<body>
			  <video id="my-video" class="video-js" data-setup='` + JSON.stringify(options) + `'>
			    <source src="` + playlist[Math.floor(Math.random() * playlist.length)] + `" type='video/mp4'>
			  </video>

			  <script src="scripts/video.js"></script>
			  <script>
				document.addEventListener('contextmenu', event => event.preventDefault());
				var video = videojs('my-video').ready(function(){
				  var player = this;

				  player.on('ended', function() {
				    window.location.reload();
				  });
				  
				  player.on('timeupdate', function(e){
				  	var percent = (player.currentTime() / player.duration()) * 100;
				  	if(percent >= 98){
						window.location.reload();
					}
				  });
				});
			  </script>
			</body>
		`;

        res.setHeader('Content-Type', 'text/html');

        if (playlist.length) {
            return res.send(html);
        } else {
            return res.send(`
			<center><h1>No playable items</h1></center>
    	`);
        }
    });
}

console.log('[ ' + ((add_this) ? 'fileserver' : 'player') + ' ] ' + ((add_this) ? 'fileserver' : 'player') + ' listening to ', 'http://' + HOST + ':' + PORT);
app.listen(PORT, HOST);
