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
        broadcastMessage(socket, userObject.room, message);
    });

    socket.on('userConnected', user => {
        setUser(socket, user);
    });

    socket.on('disconnect', () => {
        deleteUser(socket, userObject);
    });
}

function initialize(userObject, socket){
    setUser(socket, userObject);
    sendWelcome(socket, userObject);
}

async function sendWelcome(socket, userObject){

    let previousConnectedUsers = await getPreviousConnectedUsers(socket, userObject);
    let previousMessages = await getPreviousMessages(socket, userObject.room);

    socket.emit('Welcome', {
        previousConnectedUsers: previousConnectedUsers,
        previousMessages: previousMessages,
        user: userObject
    });
}

function setUser(socket, userObject){

    key = getRoomKey(userObject.room, `users:${userObject.id}`);
    userObject = JSON.stringify(userObject);
    redisClient.set(key, userObject);
    socket.broadcast.emit('userConnected', userObject);
}

function deleteUser(socket, userObject){
    key = getRoomKey(userObject.room, `users:${userObject.id}`);
    redisClient.del(key);
    socket.broadcast.emit('userDisconnected', userObject);
}

function getPreviousConnectedUsers(socket, userObject){
    return new Promise((resolve, reject) => {
        pattern = getRoomKey(userObject.room, `users:*`);
        redisClient.keys(pattern, function(err, keys) {        
            redisClient.mget(keys, function(err, users) {
                resolve(users);
            });
        });
    });
}

function getPreviousMessages(socket, room){
    return new Promise((resolve, reject) => {
        key = getRoomKey(room, 'messages');
        redisClient.lrange(key, 0, -1, function(err, reply) {
            resolve(reply); 
        });
    });
}

function broadcastMessage(socket, room, data) {
    key = getRoomKey(room, 'messages');
    data = JSON.stringify(data);
    redisClient.rpush(key, data, function(err, reply) {
        socket.broadcast.emit('receivedMessage', data); 
    });
}

function getRoomKey(room, key) {
    return `rooms:${room}:${key}`;
}

function getUserFromConnect(socket) {
    let socketData = socket.request._query; 

    return {
        id: socketData['id'],
        name: socketData['name'],
        room: socketData['room']
    };
}

server.listen(3000);