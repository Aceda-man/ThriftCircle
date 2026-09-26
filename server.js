import express from "express"
import dns from "node:dns"
import "dotenv/config"
import connectDB from "./config/db.js"
import router from "./routes/index.js";

const app = express()


app.use(express.json());
app.use("/api", router);

dns.setServers(["8.8.8.8", "1.1.1.1"])

//import connectDB function and call it to connect to the database
connectDB();

//start the server and listen on port 3000
app.listen(process.env.PORT, ()=> {
    console.log(`server running on port ${process.env.PORT}`)
})