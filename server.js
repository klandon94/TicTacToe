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

let winCombos = [[1,2,3], [4,5,6], [7,8,9], [1,5,9], [3,5,7], [1,4,7], [2,5,8], [3,6,9]];

io.on('connection', socket=>{
    socket.setMaxListeners(15);
    
    socket.on('create', data=>{
        Promise.all(['roomsCount', 'allRooms'].map(key=>redis.getAsync(key))).then(results=>{
            let roomsCount = results[0];
            const allRooms = JSON.parse(results[1]);
            let fullRooms = allRooms["fullRooms"];
            let emptyRooms = allRooms["emptyRooms"];
            if (!emptyRooms.includes(roomsCount)){
                roomsCount++;
                emptyRooms.push(roomsCount);

                socket.join("Room#" + roomsCount);
                redis.set("roomsCount", roomsCount);
                redis.set("allRooms", JSON.stringify({
                    fullRooms: fullRooms,
                    emptyRooms: emptyRooms
                }));
                io.emit('roomsavailable', {
                    'roomsCount': roomsCount,
                    'fullRooms' : fullRooms,
                    'emptyRooms': emptyRooms
                });
                io.sockets.in("Room#" + roomsCount).emit('newroom', {
                    'roomsCount': roomsCount,
                    'fullRooms' : fullRooms,
                    'emptyRooms': emptyRooms,
                    'roomNumber': roomsCount
                })
            }
        });
    });

    socket.on('join', data=>{
        const roomNum = data.roomNum;
        Promise.all(['roomsCount', 'allRooms'].map(key=>redis.getAsync(key))).then(results =>{
            let roomsCount = results[0];
            const allRooms = JSON.parse(results[1]);
            let fullRooms = allRooms['fullRooms'];
            let emptyRooms = allRooms['emptyRooms'];
            if (emptyRooms.indexOf(roomNum) !== -1){
                emptyRooms.splice(emptyRooms.indexOf(roomNum), 1);
                fullRooms.push(roomNum);
            }
            socket.join("Room#" + roomNum)

            redis.set("allRooms", JSON.stringify({
                fullRooms: fullRooms,
                emptyRooms: emptyRooms
            }));
            const currRoom = (Object.keys(io.sockets.adapter.sids[socket.id]).filter(i => i!=socket.id)[0].split('#')[1]);
            io.emit('roomsavailable', {
                'roomsCount': roomsCount,
                'fullRooms' : fullRooms,
                'emptyRooms': emptyRooms
            });
            io.sockets.in("Room#" + roomNum).emit('startgame', {
                'roomsCount': roomsCount,
                'fullRooms' : fullRooms,
                'emptyRooms': emptyRooms,
                'roomNumber': currRoom
            });
        });
    });

    socket.on('move', data=>{
        const playedGameGrid = data.playedGameGrid;
        const movesPlayed = data.movedPlayed;
        const roomNum = data.roomNum;
        let winner = null;
        winCombos.forEach(combo => {
            if (playedGameGrid[combo[0]] !== undefined && playedGameGrid[combo[1]] !== undefined && playedGameGrid[combo[2]] !== undefined && playedGameGrid[combo[0]]['player'] === playedGameGrid[combo[1]]['player'] && playedGameGrid[combo[1]]['player'] === playedGameGrid[combo[2]]['player']) winner = playedGameGrid[combo[0]]['player'] + " wins!";

            else if (movesPlayed === 9) winner = "Draw";

            return false;
        });
        if (winner === null){
            socket.broadcast.to("Room#" + roomNum).emit("receive", {
                'position': data.position,
                'played': data.played,
                'winner': null
            });
        } else{
            io.sockets.in("Room#" + roomNum).emit("receive", {
                'position': data.position,
                'played': data.played,
                'winner': winner
            });
        }
    });

    socket.on('disconnect', () => {
        const rooms = Object.keys(socket.rooms);
        const roomNum = (rooms[1] !== undefined) ? (rooms[1]).split('#')[1] : null;
        if (rooms !== null){
            Promise.all(['roomsCount', 'allRooms'].map(key => redis.getAsync(key))).then(results=>{
                let roomsCount = results[0];
                const allRooms = JSON.parse(results[1]);
                let fullRooms = allRooms['fullRooms'];
                let emptyRooms = allRooms['emptyRooms'];
                if (fullRooms.indexOf(parseInt(roomNum)) !== -1) fullRooms.splice(fullRooms.indexOf(parseInt(roomNum)), 1);
                if (roomsCount > 1) roomsCount--;
                else roomsCount = 1;
                
                redis.set('roomsCount', roomsCount);
                redis.set('allRooms', JSON.stringify({
                    emptyRooms: emptyRooms,
                    fullRooms: fullRooms
                }));

                io.sockets.in("Room#" + roomNum).emit('roomdisconnect', {id: socket.id});
            });
        }
    });

})

app.get("/getRoomInfo", (req, res) =>{
    Promise.all(['roomsCount', 'allRooms'].map(key => redis.getAsync(key))).then(results =>{
        const roomsCount = results[0];
        const allRooms = JSON.parse(results[1]);
        return res.status(200).json({
            'roomsCount': roomsCount,
            'fullRooms': allRooms['fullRooms'],
            'emptyRooms': allRooms['emptyRooms']
        })
    })
})

app.listen(port, ()=>{
    console.log("Live on port " + port);
})