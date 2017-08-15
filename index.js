#!/home/fallen90/.nvm/versions/node/v6.10.2/bin/node

let __currentdirr = process.cwd();
let saved_dirs = [__currentdirr,
	'/media/fallen90/Workspace/Foster/',
	'/home/fallen90/Videos/',
	'/home/fallen90/Videos/BabyLooneyTunes/',
	'/media/fallen90/BRUH/Sofia the first/',
	'/media/fallen90/Spare HDD/Downloads/Sheriff Callie\'s Wild West Season 1, Episodes 01-17 [Nanto]/',
	//	'/media/fallen90/Spare HDD/Downloads/Danny Phantom/Season 3/',
	//	'/media/fallen90/Spare HDD/Downloads/Danny Phantom/Season 2/',
	//	'/media/fallen90/Spare HDD/Downloads/Danny Phantom/Season 1/',
	'/media/fallen90/Era/Movies/Jake and the neverland pirates/',
	// '/media/fallen90/MICHAEL/Chalkzone/', 
	'/media/fallen90/Era/Movies/Doc.McStuffins.S01E01-26.720p.WEB-DL.x264.AAC/'
];
let express = require('express');
let app = express();
var server = require('http').createServer(app);
var io = require('socket.io').listen(server);



let nsort = require('node-natural-sort');
let path = require('path');
let argv = require('minimist')(process.argv.slice(2));
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
let just_played = [];

function init(req) {
	let deferred = Promise.defer();
	let items_all = [];
	_.each(saved_dirs, function (dir) {
		let items = [];
		try { items = fs.readdirSync(dir); } catch (e) {
			return;
		}
		let hostname = '/'; //req.protocol + '://' + req.get('host') + '/';
		Array.prototype.push.apply(items_all, items.filter(item => {
			return _.contains(['.mp4', '.mp3', '.m4a', '.webm', '.webp', '.weba'], path.extname(item).toLowerCase());
		}).map(item => {
			let url = hostname + encodeURIComponent(item);
			return url;
		}).sort(nsort()));
	});

	let transformed = [];

	_.each(items_all, item => {
		transformed.push({
			sources: [{
				src: item,
				type: 'video/mp4'
			}],
			poster: '/poster.png'
		});
	});

	items_all = transformed;

	deferred.resolve(items_all);
	return deferred.promise;
}

function shuffle(a) {
	for (let i = a.length; i; i--) {
		let j = Math.floor(Math.random() * i);
		[a[i - 1], a[j]] = [a[j], a[i - 1]];
	}

	for (let i = a.length; i; i--) {
		let j = Math.floor(Math.random() * i);
		[a[i - 1], a[j]] = [a[j], a[i - 1]];
	}

	for (let i = a.length; i; i--) {
		let j = Math.floor(Math.random() * i);
		[a[i - 1], a[j]] = [a[j], a[i - 1]];
	}

	for (let i = a.length; i; i--) {
		let j = Math.floor(Math.random() * i);
		[a[i - 1], a[j]] = [a[j], a[i - 1]];
	}

	for (let i = a.length; i; i--) {
		let j = Math.floor(Math.random() * i);
		[a[i - 1], a[j]] = [a[j], a[i - 1]];
	}
}

app.set('view engine', 'ejs');


app.use(express.static(__currentdirr));
_.each(saved_dirs, function (dir) { app.use(express.static(dir)); });
if (add_this && add_this_host != false) {
	let urlObject = url.parse(add_this_host);
	urlObject.get = function (key) {
		return this[key];
	}
	init({
		protocol: urlObject.protocol.replace(':', ''),
		get: function (key) {
			if (key == 'host') {
				return urlObject.hostname + ':' + PORT;
			}
		}
	}).then(function (ls) { request(add_this_host + '/playlist/?json=' + JSON.stringify(ls), (error, response, body) => { console.log('Player response', response.body); }); }, function (err) { console.log('Error', err); });
} else {
	app.get('/playlist', (req, res) => {
		var json = req.query.json;
		let data = JSON.parse(json);
		let playlist_before = playlist;
		_.each(data, item => {
			let url_item = url.parse(item);
			console.log(url_item.host, url_item.path);
			playlist.push(url_item.href);
		});
		return res.json({ status: 'OK', added: data.length });
	});
	app.use('/scripts', express.static(__dirname + '/node_modules/'));
	app.use('/scripts', express.static(__dirname + '/node_modules/'));
	app.use('/', express.static(__dirname + '/views/'));

	app.get('/', (req, res) => { res.redirect('/init'); });
	app.get('/list', (req, res) => {
		return res.jsonp(playlist);
	});
	app.get('/init', (req, res) => {
		init(req).then(function (ls) {
			playlist = ls;
			res.redirect('/viewer');
		}, function (err) { 
			return res.json(err);
		});
	});
	app.get('/viewer', (req, res) => {

		if (!playlist.length) {
			return res.redirect('/init');
		}

		shuffle(playlist);

		playlist = playlist;
		res.render('index', { playlist: playlist, is_sync : (req.query.sync) ? true : false });
	});

	app.get('/controller', (req, res)=>{
		res.render('controller');
	});
	
	app.get('/crashed', (req, res)=>{
		res.render('crashed');
	});
}

let moment = require('moment');

io.on('connection', function (socket) {
	let current_player = 0;
	socket.on('timeupdate', function (msg) {
		let time_rcvd = moment().unix();
		let main_client_time_sent = msg.time_sent;
		let time_spent = time_rcvd - main_client_time_sent; //inseconds

		msg.time_spent = time_spent;
		msg.time_sent = moment().unix();
		io.sockets.emit('timeupdate', msg);
	});
	socket.on('controller', function (msg) {
		io.sockets.emit('controller', msg);
	});
	socket.on('current_playlist', function (msg) {
		io.sockets.emit('current_playlist', msg);
	});
});


console.log('[ ' + ((add_this) ? 'fileserver' : 'player') + ' ] ' + ((add_this) ? 'fileserver' : 'player') + ' listening to ', 'http://' + HOST + ':' + PORT);

server.listen(PORT, HOST);

process.on('uncaughtException', function (err) {
	PORT = parseInt(8080) + 1;
	console.log('[ ' + ((add_this) ? 'fileserver' : 'player') + ' ] ' + ((add_this) ? 'fileserver' : 'player') + ' listening to ', 'http://' + HOST + ':' + PORT);
	server.listen(PORT, HOST);
});
