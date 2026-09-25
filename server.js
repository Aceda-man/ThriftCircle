import express from "express"
import dns from "node:dns"
import "dotenv/config"
import connectDB from "./config/db.js"

const app = express()


dns.setServers(["8.8.8.8", "8.8.4.4"])

//import connectDB function and call it to connect to the database
connectDB();

//start the server and listen on port 3000
app.listen(process.env.PORT, ()=> {
    console.log(`server running on port ${process.env.PORT}`)
})