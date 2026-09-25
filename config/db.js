import mongoose from "mongoose"

//function to connect to the database
async function connectDB() {
    try {
        const atlas_string = process.env.ATLAS_STRING;
        await mongoose.connect(atlas_string);
        console.log("Mongodb connected successfully");
    }
   catch (error) {
        console.error("Connection error: ", error);
    }
}

export default connectDB