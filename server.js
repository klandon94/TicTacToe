const express = require("express");
const app = express();
const cors = require("cors");
const bodyParser = require("body-parser");
const port = 1234;

const server = app.listen(port);
const io = require("socket.io")(server);

const redis = require("./server/config/redis").connect();

app.use(bodyParser.json());
app.use(express.static( __dirname + '/client/public/dist/public' ));
app.use(cors());

redis.set("roomsCount", 1);
redis.set("allRooms", JSON.stringify({
    fullRooms:[],
    emptyRooms:[1]
}));

this.winCombos = [[1,2,3], [4,5,6], [7,8,9], [1,5,9], [3,5,7], [1,4,7], [2,5,8], [3,6,9]];

let allRooms;
let roomsCount;

io.on('connection', socket=>{
    socket.setMaxListeners(15);
    
    socket.on('create-room', data=>{
        Promise.all(['roomsCount', 'allRooms'].map(key=>redis.getAsync(key))).then(results=>{
            let roomsCount = results[0];
            const allRooms = JSON.parse(results[1]);
            let fullRooms = allRooms["fullRooms"];
            let emptyRooms = allRooms["emptyRooms"];
            if (!emptyRooms.includes(roomsCount)){
                roomsCount++;
                emptyRooms.push(roomsCount);
                socket.join("room #"+roomsCount);
                redis.set("roomsCount", roomsCount);
                redis.set("allRooms", JSON.stringify({
                    fullRooms: fullRooms,
                    emptyRooms: emptyRooms
                }));
                io.emit('rooms-available', {
                    'roomsCount': roomsCount,
                    'fullRooms' : fullRooms,
                    'emptyRooms': emptyRooms,
                });
                io.sockets.in("room #"+roomsCount).emit('new-room', {
                    'roomsCount': roomsCount,
                    'fullRooms' : fullRooms,
                    'emptyRooms': emptyRooms,
                    'roomNumber': roomsCount
                })
            }
        });
    });



})


app.listen(port, ()=>{
    console.log("Live on port " + port);
})