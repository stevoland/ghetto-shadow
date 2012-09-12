var io = require('socket.io').listen(8001);

io.sockets.on('connection', function (socket) {
  /*socket.emit('news', { hello: 'world' });*/

  socket.on('join', function (id) {
    socket.set('room', id, function () { 
        socket.emit('ready'); 
    });
    socket.join(id);
  });

  socket.on('msg', function (msg) {
    socket.get('room', function (err, id) {
      socket.broadcast.to(id).emit('msg', msg);
    });
  });
});