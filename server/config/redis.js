class redisDB{
    
    constructor(){
        this.redis = require("redis");
    }

    connect(){
        const client = this.redis.createClient({
            port:1234,
            host:"127.0.0.1"
        })

        client.on("error", err =>{
            console.log("Something went wrong", err);
        })

        client.on("ready", err =>{
            console.log("Ready...");
        })

        require("bluebird").promisifyAll(client);
        return client;
    }

}

module.exports = new redisDB();