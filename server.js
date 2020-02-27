const express = require('express');
const path = require('path');
const redis = require('redis');

const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server);

const redisClient = redis.createClient(6379);
 
redisClient.on('error', (err) => {
    console.log("Error " + err)
});

app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'public'));
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');

app.use('/', (req, res) => {
    res.render('index.html');
});

io.on('connection', socket => {
    handleSocket(socket);
});

function handleSocket(socket) 
{
    var userObject = getUserFromConnect(socket);

    initialize(userObject, socket);

    socket.on('sendMessage', message => {
        broadcastEmitSocketListPush(socket, userObject.contract, 'messages', 'receivedMessage', message);
    });

    socket.on('disconnect', () => {
        socket.emit('userDisconnected', userObject);
    });
}

function initialize(userObject, socket){
    broadcastEmitSocketListPush(socket, userObject.contract, 'users', 'userConnected', userObject);
    //nao emitir ou atualizar quando for o próprio
    emitSocketListResults(socket, userObject.contract, 'users', 'previousConnectedUsers');
    emitSocketListResults(socket, userObject.contract, 'messages', 'previousMessages');
}

function emitSocketListResults(socket, contract, key = 'messages', event = 'previousMessages', start = 0, stop = -1){
    key = getContractKey(contract, key);
    redisClient.lrange(key, start, stop, function(err, reply) {
        socket.emit(event, reply); 
    });
}

function broadcastEmitSocketListPush(socket, contract, key = 'users', event = 'userConnected', data) {
    key = getContractKey(contract, key);
    data = JSON.stringify(data);
    redisClient.rpush(key, data, function(err, reply) {
        socket.broadcast.emit(event, data); 
    });
}

function getContractKey(contract, key = 'users') {
    return `contracts:${contract}:${key}`;
}

function getUserFromConnect(socket) {
    let socketData = socket.request._query; 

    return {
        id: socketData['id'],
        name: socketData['name'],
        contract: socketData['contract']
    };
}
server.listen(3000);