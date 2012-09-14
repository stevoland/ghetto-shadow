var io = require('socket.io'),
	express = require('express'),
	app = express(),
	server = require('http').createServer(app);
	
io = io.listen(server);
server.listen(8001);

app.use("/test", express.static(__dirname + '/test'));
app.use("/public", express.static(__dirname + '/public'));

io.sockets.on('connection', function (socket) {

	socket.on('join', function (key) {
		socket.set('room', key, function () {
				socket.emit('ready');
		});
		socket.join(key);
	});

	socket.on('href', function (href) {
		socket.get('room', function (err, key) {
			socket.broadcast.to(key).emit('href', href);
		});
	});

	socket.on('event', function (e) {
		socket.get('room', function (err, key) {
			socket.broadcast.to(key).emit('event', e);
		});
	});

	socket.on('reload', function () {
		socket.get('room', function (err, key) {
			socket.broadcast.to(key).emit('reload');
		});
	});
});